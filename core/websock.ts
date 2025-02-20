/*
 * Websock: high-performance buffering wrapper
 * Copyright (C) 2019 The noVNC Authors
 * Licensed under MPL 2.0 (see LICENSE.txt)
 *
 * Websock is similar to the standard WebSocket / RTCDataChannel object
 * but with extra buffer handling.
 *
 * Websock has built-in receive queue buffering; the message event
 * does not contain actual data but is simply a notification that
 * there is new data available. Several rQ* methods are available to
 * read binary data off of the receive queue.
 */

// @ts-ignore
import * as Log from './util/logging.js';

export interface EventHandlers {
    message : (e?:Event)=>void;
    open : (e?:Event)=>void;
    close : (e?:Event)=>void;
    error : (e?:Event)=>void;
}

// this has performance issues in some versions Chromium, and
// doesn't gain a tremendous amount of performance increase in Firefox
// at the moment.  It may be valuable to turn it on in the future.
const MAX_RQ_GROW_SIZE = 40 * 1024 * 1024;  // 40 MiB

// Constants pulled from RTCDataChannelState enum
// https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/readyState#RTCDataChannelState_enum
const DataChannel = {
    CONNECTING: "connecting",
    OPEN: "open",
    CLOSING: "closing",
    CLOSED: "closed"
};

const ReadyStates = {
    CONNECTING: [WebSocket.CONNECTING, DataChannel.CONNECTING],
    OPEN: [WebSocket.OPEN, DataChannel.OPEN],
    CLOSING: [WebSocket.CLOSING, DataChannel.CLOSING],
    CLOSED: [WebSocket.CLOSED, DataChannel.CLOSED],
};

// Properties a raw channel must have, WebSocket and RTCDataChannel are two examples
const rawChannelProps = [
    "send",
    "close",
    "binaryType",
    "onerror",
    "onmessage",
    "onopen",
    "protocol",
    "readyState",
];

export default class Websock {
    _websocket : WebSocket|null;
    _rQi : number;
    _rQlen : number;
    _rQbufferSize : number;
    _rQ : Uint8Array|null;
    _sQbufferSize : number;
    _sQlen : number;
    _sQ : Uint8Array|null;
    _eventHandlers : EventHandlers


    constructor() {
        this._websocket = null;  // WebSocket or RTCDataChannel object

        this._rQi = 0;           // Receive queue index
        this._rQlen = 0;         // Next write position in the receive queue
        this._rQbufferSize = 1024 * 1024 * 4; // Receive queue buffer size (4 MiB)
        // called in init: this._rQ = new Uint8Array(this._rQbufferSize);
        this._rQ = null; // Receive queue

        this._sQbufferSize = 1024 * 10;  // 10 KiB
        // called in init: this._sQ = new Uint8Array(this._sQbufferSize);
        this._sQlen = 0;
        this._sQ = null;  // Send queue

        this._eventHandlers = {
            message: () => {},
            open: () => {},
            close: () => {},
            error: () => {}
        };
    }

    // Getters and Setters
    get sQ() {
        return this._sQ;
    }

    get rQ() {
        return this._rQ;
    }

    get rQi() {
        return this._rQi;
    }

    set rQi(val) {
        this._rQi = val;
    }

    // Receive Queue
    get rQlen() {
        return this._rQlen - this._rQi;
    }

    rQpeek8() {
        return this._rQ[this._rQi];
    }

    rQskipBytes(bytes:number) {
        this._rQi += bytes;
    }

    rQshift8() {
        return this._rQshift(1);
    }

    rQshift16() {
        return this._rQshift(2);
    }

    rQshift32() {
        return this._rQshift(4);
    }

    // TODO(directxman12): test performance with these vs a DataView
    _rQshift(bytes:number) {
        let res = 0;
        for (let byte = bytes - 1; byte >= 0; byte--) {
            res += this._rQ[this._rQi++] << (byte * 8);
        }
        return res;
    }

    rQshiftStr(len:number) {
        if (typeof(len) === 'undefined') { len = this.rQlen; }
        let str = "";
        // Handle large arrays in steps to avoid long strings on the stack
        for (let i = 0; i < len; i += 4096) {
            let part = this.rQshiftBytes(Math.min(4096, len - i));
            str += String.fromCharCode.apply(null, part);
        }
        return str;
    }

    rQshiftBytes(len:number) {
        if (typeof(len) === 'undefined') { len = this.rQlen; }
        this._rQi += len;
        return new Uint8Array(this._rQ.buffer, this._rQi - len, len);
    }

    rQshiftTo(target:Uint8Array, len:number) {
        if (len === undefined) { len = this.rQlen; }
        // TODO: make this just use set with views when using a ArrayBuffer to store the rQ
        target.set(new Uint8Array(this._rQ.buffer, this._rQi, len));
        this._rQi += len;
    }

    rQslice(start:number, end:number = this.rQlen) {
        return new Uint8Array(this._rQ.buffer, this._rQi + start, end - start);
    }

    // Check to see if we must wait for 'num' bytes (default to FBU.bytes)
    // to be available in the receive queue. Return true if we need to
    // wait (and possibly print a debug message), otherwise false.
    rQwait(msg:any, num:number, goback?:number) {
        if (this.rQlen < num) {
            if (goback) {
                if (this._rQi < goback) {
                    throw new Error("rQwait cannot backup " + goback + " bytes");
                }
                this._rQi -= goback;
            }
            return true; // true means need more data
        }
        return false;
    }

    // Send Queue

    flush() {
        if (this._sQlen > 0 && ReadyStates.OPEN.indexOf(this._websocket.readyState) >= 0) {
            this._websocket.send(this._encodeMessage());
            this._sQlen = 0;
        }
    }

    send(arr:Uint8Array|number[]) {
        this._sQ.set(arr, this._sQlen);
        this._sQlen += arr.length;
        this.flush();
    }

    sendString(str:string) {
        this.send(str.split('').map(chr => chr.charCodeAt(0)));
    }

    // Event Handlers
    off(evt:keyof EventHandlers) {
        this._eventHandlers[evt] = () => {};
    }

    on(evt:keyof EventHandlers, handler:(e:any)=>void) {
        this._eventHandlers[evt] = handler;
    }

    _allocateBuffers() {
        this._rQ = new Uint8Array(this._rQbufferSize);
        this._sQ = new Uint8Array(this._sQbufferSize);
    }

    init() {
        this._allocateBuffers();
        this._rQi = 0;
        this._websocket = null;
    }

    open(uri:string, protocols:string|string[]) {
        this.attach(new WebSocket(uri, protocols));
    }

    attach(rawChannel:WebSocket) {
        this.init();

        // Must get object and class methods to be compatible with the tests.
        const channelProps = [...Object.keys(rawChannel), ...Object.getOwnPropertyNames(Object.getPrototypeOf(rawChannel))];
        for (let i = 0; i < rawChannelProps.length; i++) {
            const prop = rawChannelProps[i];
            if (channelProps.indexOf(prop) < 0) {
                throw new Error('Raw channel missing property: ' + prop);
            }
        }

        this._websocket = rawChannel;
        this._websocket.binaryType = "arraybuffer";
        this._websocket.onmessage = this._recvMessage.bind(this);

        const onOpen = () => {
            Log.Debug('>> WebSock.onopen');
            if (this._websocket.protocol) {
                Log.Info("Server choose sub-protocol: " + this._websocket.protocol);
            }

            this._eventHandlers.open();
            Log.Debug("<< WebSock.onopen");
        };

        // If the readyState cannot be found this defaults to assuming it's not open.
        const isOpen = ReadyStates.OPEN.indexOf(this._websocket.readyState) >= 0;
        if (isOpen) {
            onOpen();
        } else {
            this._websocket.onopen = onOpen;
        }

        this._websocket.onclose = (e:CloseEvent) => {
            Log.Debug(">> WebSock.onclose");
            this._eventHandlers.close(e);
            Log.Debug("<< WebSock.onclose");
        };

        this._websocket.onerror = (e:Event) => {
            Log.Debug(">> WebSock.onerror: " + e);
            this._eventHandlers.error(e);
            Log.Debug("<< WebSock.onerror: " + e);
        };
    }

    close() {
        if (this._websocket) {
            if (ReadyStates.CONNECTING.indexOf(this._websocket.readyState) >= 0 ||
                ReadyStates.OPEN.indexOf(this._websocket.readyState) >= 0) {
                Log.Info("Closing WebSocket connection");
                this._websocket.close();
            }

            this._websocket.onmessage = () => {};
        }
    }

    // private methods
    _encodeMessage() {
        // Put in a binary arraybuffer
        // according to the spec, you can send ArrayBufferViews with the send method
        return new Uint8Array(this._sQ.buffer, 0, this._sQlen);
    }

    // We want to move all the unread data to the start of the queue,
    // e.g. compacting.
    // The function also expands the receive que if needed, and for
    // performance reasons we combine these two actions to avoid
    // unneccessary copying.
    _expandCompactRQ(minFit:number) {
        // if we're using less than 1/8th of the buffer even with the incoming bytes, compact in place
        // instead of resizing
        const requiredBufferSize =  (this._rQlen - this._rQi + minFit) * 8;
        const resizeNeeded = this._rQbufferSize < requiredBufferSize;

        if (resizeNeeded) {
            // Make sure we always *at least* double the buffer size, and have at least space for 8x
            // the current amount of data
            this._rQbufferSize = Math.max(this._rQbufferSize * 2, requiredBufferSize);
        }

        // we don't want to grow unboundedly
        if (this._rQbufferSize > MAX_RQ_GROW_SIZE) {
            this._rQbufferSize = MAX_RQ_GROW_SIZE;
            if (this._rQbufferSize - this.rQlen < minFit) {
                throw new Error("Receive Queue buffer exceeded " + MAX_RQ_GROW_SIZE + " bytes, and the new message could not fit");
            }
        }

        if (resizeNeeded) {
            const oldRQbuffer = this._rQ.buffer;
            this._rQ = new Uint8Array(this._rQbufferSize);
            this._rQ.set(new Uint8Array(oldRQbuffer, this._rQi, this._rQlen - this._rQi));
        } else {
            this._rQ.copyWithin(0, this._rQi, this._rQlen);
        }

        this._rQlen = this._rQlen - this._rQi;
        this._rQi = 0;
    }

    // push arraybuffer values onto the end of the receive que
    _DecodeMessage(data:Uint8Array) {
        const u8 = new Uint8Array(data);
        if (u8.length > this._rQbufferSize - this._rQlen) {
            this._expandCompactRQ(u8.length);
        }
        this._rQ.set(u8, this._rQlen);
        this._rQlen += u8.length;
    }

    _recvMessage(e:MessageEvent) {
        this._DecodeMessage(e.data);
        if (this.rQlen > 0) {
            this._eventHandlers.message();
            if (this._rQlen == this._rQi) {
                // All data has now been processed, this means we
                // can reset the receive queue.
                this._rQlen = 0;
                this._rQi = 0;
            }
        } else {
            Log.Debug("Ignoring empty message");
        }
    }
}

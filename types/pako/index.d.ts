declare module Pako {
  /**
   * Zlib ZStream interface. Encapsulates the state of a deflate/inflate operation.
   */
  export interface ZStream {
    /* input buffer. */
    input: number[] | Uint8Array;
    /* next input byte */
    next_in: number;
    /* number of bytes available at input */
    avail_in: number;
    /* total number of input bytes read so far */
    total_in: number;
    /* output buffer */
    output: number[] | Uint8Array;
    /* next output byte */
    next_out: number;
    /* remaining free space at output */
    avail_out: number;
    /* total number of bytes output so far */
    total_out: number;
    /* last error message, NULL if no error */
    msg: string;
    /* not visible by applications */
    state: any;
    /* best guess about the data type: binary or text */
    data_type: ZlibDataType;
    /* adler32 value of the uncompressed data */
    adler: number;
  }
  export const enum ZlibReturnCode {
    Z_OK = 0,
    Z_STREAM_END = 1,
    Z_NEED_DICT = 2,
    Z_ERRNO = -1,
    Z_STREAM_ERROR = -2,
    Z_DATA_ERROR = -3,
    Z_BUF_ERROR = -5
  }
  export const enum ZlibFlushValue {
    Z_NO_FLUSH = 0,
    Z_PARTIAL_FLUSH = 1,
    Z_SYNC_FLUSH = 2,
    Z_FULL_FLUSH = 3,
    Z_FINISH = 4,
    Z_BLOCK = 5,
    Z_TREES = 6
  }
  export const enum ZlibDataType {
    Z_BINARY = 0,
    Z_TEXT = 1,
    Z_ASCII = 1,
    Z_UNKNOWN = 2
  }
  /**
   * GZip header.
   */
  export interface GZHeader {
    /* true if compressed data believed to be text */
    text: number;
    /* modification time */
    time: number;
    /* extra flags (not used when writing a gzip file) */
    xflags: number;
    /* operating system */
    os: number;
    /* pointer to extra field or Z_NULL if none */
    extra: any;
    /* extra field length (valid if extra != Z_NULL) */
    extra_len: number;
    /* pointer to zero-terminated file name or Z_NULL */
    name: string;
    /* pointer to zero-terminated comment or Z_NULL */
    comment: string;
    /* true if there was or will be a header crc */
    hcrc: number;
    /* true when done reading gzip header (not used when writing a gzip file) */
    done: boolean;
  }
  /**
   * Inflate options.
   */
  export interface IInflateOptions {
    // The windowBits parameter is the base two logarithm of the window
    // size (the size of the history buffer). Larger values of this parameter
    // result in better compression at the expense of memory usage.
    windowBits?: number;
    // size of generated data chunks (16K by default)
    chunkSize?: number;
    // do raw inflate (no header)
    raw?: boolean;
    // if equal to 'string', then result will be converted from utf8 to utf16
    // (javascript) string. When string output requested, chunk length can differ
    // from chunkSize, depending on content.
    to?: string;
  }
}

declare module "pako" {
  /**
   * An instance of a pako inflater.
   * T is the output data type, which can be an array, Uint8Array, or string.
   */
  export class Inflate<T extends Array<number> | Uint8Array | string> {
    constructor(opts?: Pako.IInflateOptions);
    // Error code after inflate finished. 0 (Z_OK) on success. Should be checked if
    // broken data possible.
    public err: Pako.ZlibReturnCode;
    // Error message, if Inflate.err != 0
    public msg: string;
    // The header of the gzipped item.
    public header: Pako.GZHeader;
    public strm: Pako.ZStream;
    public options: Pako.IInflateOptions;
    public chunks: T[];
    public ended: boolean;
    /**
     * Uncompressed result, generated by default Inflate#onData and Inflate#onEnd
     * handlers. Filled after you push last chunk (call Inflate#push with Z_FINISH /
     * true param) or if you push a chunk with explicit flush (call Inflate#push with
     * Z_SYNC_FLUSH param).
     */
    public result: T;
    /**
     * By default, stores data blocks in chunks[] property and glue those in onEnd.
     * Override this handler, if you need another behaviour.
     */
    public onData(chunk: T): void;
    /**
     * Called either after you tell inflate that the input stream is complete
     * (Z_FINISH) or should be flushed (Z_SYNC_FLUSH) or if an error happened. By
     * default - join collected chunks, free memory and fill results / err properties.
     */
    public onEnd(status: Pako.ZlibFlushValue): void;
    /**
     * Called either after you tell inflate that the input stream is complete
     *(Z_FINISH) or should be flushed (Z_SYNC_FLUSH) or if an error happened. By
     * default - join collected chunks, free memory and fill results / err properties.
     */
    public onStatus(status: Pako.ZlibFlushValue): void;
    /**
     * Sends input data to inflate pipe, generating Inflate#onData calls with new output chunks. Returns true on success. The last data block must have mode Z_FINISH (or true). That will flush internal pending buffers and call Inflate#onEnd. For interim explicit flushes (without ending the
     * stream) you can use mode Z_SYNC_FLUSH, keeping the decompression context.
     *
     * On fail call Inflate#onEnd with error code and return false.
     *
     * We strongly recommend to use Uint8Array on input for best speed (output format is detected automatically). Also, don't skip last param and always use the same type in your code (boolean or number). That will improve JS speed.
     *
     * For regular Array-s make sure all elements are [0..255].
     * @param data input data
     * @param mode Z_NO_FLUSH..Z_TREE modes. Skipped or false means Z_NO_FLUSH, true meansh Z_FINISH.
     */
    public push(data: Uint8Array | Array<number> | ArrayBuffer | string, mode: boolean | Pako.ZlibFlushValue): void;
  }

  /**
   * Decompress data with inflate/ungzip and options. Autodetect format via wrapper header by default.
   * That's why we don't provide separate ungzip method.
   */
  export function inflate<T extends Array<number> | Uint8Array | string>(data: Uint8Array | Array<number> | string, options?: Pako.IInflateOptions): T;
  /**
   * The same as inflate, but decompresses raw data, without wrapper (header and adler32 crc).
   */
  export function inflateRaw<T extends Array<number> | Uint8Array | string>(data: Uint8Array | Array<number> | string, options?: Pako.IInflateOptions): T;
  /**
   * Just shortcut to inflate, because it autodetects format by header.content. Done for convenience.
   */
  export function ungzip<T extends Array<number> | Uint8Array | string>(data: Uint8Array | Array<number> | string, options?: Pako.IInflateOptions): T;
}

declare module "pako/lib/zlib/crc32" {
  function crc32(crc: number, buf: number[] | Uint8Array, len: number, pos: number): number;
  export = crc32;
}

declare module "pako/lib/zlib/adler32" {
  function adler32(adler: number, buf: number[] | Uint8Array, len: number, pos: number): number;
  export = adler32;
}

declare module "pako/lib/zlib/zstream" {
  var ZStream: {
    new(): Pako.ZStream;
  };
  export = ZStream;
}

declare module "pako/lib/zlib/gzheader" {
  var GZHeader: {
    new(): Pako.GZHeader;
  };
  export = GZHeader;
}

declare module "pako/lib/zlib/inflate" {
  import ZStream = Pako.ZStream;
  import ZlibReturnCode = Pako.ZlibReturnCode;
  import ZlibFlushValue = Pako.ZlibFlushValue;
  import GZHeader = Pako.GZHeader;
  export function inflateReset(strm: ZStream): ZlibReturnCode;
  export function inflateReset2(strm: ZStream, windowBits: number): ZlibReturnCode;
  export function inflateResetKeep(strm: ZStream): ZlibReturnCode;
  export function inflateInit(strm: ZStream, windowBits:number): ZlibReturnCode;
  export function inflateInit2(strm: ZStream, windowBits: number): ZlibReturnCode;
  export function inflate(strm: ZStream, flush: ZlibFlushValue): ZlibReturnCode;
  export function inflateEnd(strm: ZStream): ZlibReturnCode;
  export function inflateGetHeader(strm: ZStream, head: GZHeader): ZlibReturnCode;
  export var inflateInfo: string;
}

declare module "pako/lib/zlib/deflate" {
  import ZStream = Pako.ZStream;
  import ZlibReturnCode = Pako.ZlibReturnCode;
  import ZlibFlushValue = Pako.ZlibFlushValue;
  import GZHeader = Pako.GZHeader;
  export function deflateInit(strm: ZStream, level: number): ZlibReturnCode;
  export function deflateInit2(strm: ZStream, level: number, method: number, windowBits: number, memLevel: number, strategy: number): ZlibReturnCode;
  export function deflateReset(strm: ZStream): ZlibReturnCode;
  export function deflateResetKeep(strm: ZStream): ZlibReturnCode;
  export function deflateSetHeader(strm: ZStream, head: GZHeader): ZlibReturnCode;
  export function deflate(strm: ZStream, flush: ZlibFlushValue): ZlibReturnCode;
  export function deflateEnd(strm: ZStream): ZlibReturnCode;
  export var deflateInfo: string;
}

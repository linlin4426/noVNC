This is an experiment of integrating a h264 encoder/decoder in vnc. 
Motivation was to get a acceptable remote desktop for the raspberry pi. 

client: converted noVNC client to typescript and integrated a wasm h264 decoder. 
server: integrated openh264 into libvnc 

the protocol is somehow ad-hoc - at the time of creating this there was no "official" h264 spec for vnc.

this is *experimental* so don't expect everything to work without some tinkering

webpack build: npm run build

Should work with https://github.com/martin19/libvncserver/tree/experimental on server side.

See it in action https://www.youtube.com/watch?v=yL9wrNHgcQc&t=48s

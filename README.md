# h264 in vnc experiment (client)

This is an experiment of integrating a h264 encoder/decoder in vnc. 
Motivation was to get a acceptable remote desktop for the raspberry pi. 

## client
converted noVNC client (https://github.com/novnc/noVNC) to typescript and integrated a wasm h264 decoder (https://github.com/gliese1337/h264decoder). 

webpack build: `npm run build`

## server
integrated openh264 (https://github.com/cisco/openh264) and raspberry PI MMAL libraries into libvncserver (https://github.com/martin19/libvncserver)

- The protocol is somehow ad-hoc - at the time of creating this there was no "official" h264 spec for vnc.
- this is *experimental* so don't expect everything to work without some tinkering

See it in action https://www.youtube.com/watch?v=yL9wrNHgcQc&t=48s

## license
please refer to the original license of noVNC

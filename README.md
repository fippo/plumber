## Dealing with leaks
See [this mozhacks article](https://hacks.mozilla.org/2015/09/controlling-webrtc-peerconnections-with-an-extension/) for a full description of what this addon does.
![Dealing with leaks](http://24.media.tumblr.com/tumblr_l0fxmicsTs1qztjn5o1_500.gif)

## building the XPI
```
npm i -g jpm
```
(don't install locally, it will include node_modules in your xpi...)

test:
```
jpm run
```

pack:
```
jpm xpi
```

## License
MPL 2.0

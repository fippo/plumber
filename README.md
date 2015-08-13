Recommended reading:
https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_started
https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Adding_a_Button_to_the_Toolbar
https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/ui_button_toggle#Attaching_panels_to_buttons -- panel
https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/ui_button_toggle#Badged_buttons -- badge
https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/preferences_service -- prefs

## TODO
< jib> fippo: see http://mxr.mozilla.org/mozilla-central/source/dom/webidl/RTCPeerConnectionStatic.webidl#36

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


## caveats
https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules -- no doc for webrtc jsm?

var self = require('sdk/self');
var prefs = require('sdk/preferences/service');
let { Cc, Ci, Cu } = require('chrome');

var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require('sdk/panel');

var button = ToggleButton({
  id: 'verhueterli',
  label: 'verhueterli',
  icon: {
    '16': './icon_16.png',
    '32': './icon_32.png',
    '64': './icon_64.png',
    '128': './icon_128.png'
  },
  onChange: handleChange
});

var panel = panels.Panel({
  contentURL: './panel.html',
  contentScriptFile: './panel.js',
  onHide: handleHide
});

function handleChange(state) {
  if (state.checked) {
    panel.show({
      position: button
    });
  }
}

function handleHide() {
  button.state('window', {checked: false});
}

panel.port.on('check-webrtc', function(value) {
    console.log('check-webrtc', value);
    prefs.set('media.peerconnection.enabled', value);
});
panel.port.emit('check-webrtc', prefs.get('media.peerconnection.enabled'));

panel.port.on('check-iceservers', function (settings) {
    prefs.set('media.peerconnection.use_document_iceservers', !settings.forceIce);
    if (settings.forceIce) {
        prefs.set('media.peerconnection.default_iceservers', JSON.stringify([{
            urls: settings.urls,
            username: settings.username,
            credential: settings.credential
        }]));
    } // else leave it alone?

});

var windows = {};
function initWindow() {
    return {
        hasPCPermission: false,
        hasGUMPermission: false,
        pending: []
    };
}
let {webrtcUI} = Cu.import('resource:///modules/webrtcUI.jsm', {});
console.log('imported', webrtcUI);
var origReceiveMessage = webrtcUI.receiveMessage;
console.log('receiveMessage', origReceiveMessage);
webrtcUI.receiveMessage = function(msg) {
    console.log('webrtc receiveMessage', msg.name);
    var origin;
    var request;
    switch(msg.name) {
    case 'rtcpeer:Request': 
        origin = msg.target.contentPrincipal.origin;
        request = msg.data;
        console.log('request', msg.data);
        console.log('callID', request.callID, 'windowID', request.windowID);
        /*
         * console.log: webrtc-verhueterli: request {"windowID":8,"innerWindowID":12,"callID":"1","documentURI":"about:blank","secure":false}
         */
        // gives me no information about the peerconnection, its stun/turn servers etc
        // also is called between createOffer and callback which is before ice gathering
        // (the dangerous part) starts

        // per-origin permissions

        // I assume that windowID can stay the same while documentURI can change
        // FIXME: when can we clean up windows[uri]?
        if (!windows[origin]) {
            windows[origin] = initWindow();
            // ui trigger
            panel.port.emit(msg.name, {
                uri: origin
            });
        }
        if (windows[origin].hasGUMPermission || windows[origin].hasPCPermission) {
            // permission already granted
            // FIXME: just forwar to origReceiveMessage?
            msg.target.messageManager.sendAsyncMessage('rtcpeer:Allow', { callID: request.callID, windowID: request.windowID });
        } else {
            // FIXME UX: too annoying?
            panel.show({
              position: button
            });
            windows[origin].pending.push({
                callID: request.callID,
                windowID: request.windowID,
                messageManager: msg.target.messageManager
            });
        }
        break;
    case 'rtcpeer:CancelRequest':
        // happens when navigating away (soon also on closing the pc)
        // FIXME: search all windows for pending calls, potentially remove the button
        // msg.data contains callid 
        console.log('request', msg.data);
        break;
    case 'webrtc:UpdateBrowserIndicators':
        // when browser indicators are updated this implies that GUM permission has 
        // been granted (which is easier than hooking webrtc:Allow or Deny by fiddling 
        // with the mm)
        origin = msg.target.contentPrincipal.origin;
        request = msg.data;

        if (!windows[origin]) {
            windows[origin] = initWindow();
        };
        windows[origin].hasGUMPermission = request.camera || request.microphone;

        return origReceiveMessage.call(this, msg);
    default:
        return origReceiveMessage.call(this, msg);
    }
};

panel.port.on('rtcpeer:Allow', function (response) {
    console.log('allow', response.uri);
    var win = windows[response.uri];
    console.log(win, windows);
    if (win) {
        win.hasPCPermission = true;
        var pending = win.pending;
        win.pending.forEach(function (request) {
            console.log('pending', request);
            request.messageManager.sendAsyncMessage('rtcpeer:Allow', {
                callID: request.callID,
                windowID: request.windowID
            });
        });
        win.pending = [];
    }
    panel.hide(); // FIXME: not always?
});

panel.port.on('rtcpeer:Deny', function (response) {
    console.log('deny', response.uri);
    // should this also revoke GUM?
    var win = windows[response.uri];
    console.log(win, windows);
    if (win) {
        win.hasPCPermission = false;
        // this revokes the GUM grant currently just to be on the safe side
        win.hasGUMPermission = false;
        var pending = win.pending;
        win.pending.forEach(function (request) {
            console.log('pending', request);
            request.messageManager.sendAsyncMessage('rtcpeer:Deny', {
                callID: request.callID,
                windowID: request.windowID
            });
        });
        win.pending = [];
    }
    panel.hide(); // FIXME: not always?
});

exports.verhueterli = button;

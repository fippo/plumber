let { Cu } = require('chrome');

var windows = {};
function initWindow() {
    return {
        hasPCPermission: false,
        hasGUMPermission: false,
        pending: []
    };
}

let { webrtcUI } = Cu.import('resource:///modules/webrtcUI.jsm', {});

function notifyPending(pending, message) {
    pending.forEach(function (request) {
        request.messageManager.sendAsyncMessage(message, {
            callID: request.callID,
            windowID: request.windowID
        });
    });
}

// overriding receiveMessage here as indicated in
// http://hg.mozilla.org/mozilla-central/file/beb9cc29efb9/browser/modules/webrtcUI.jsm#l170
var origReceiveMessage = webrtcUI.receiveMessage;
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
        // per-origin permissions
        if (!windows[origin]) {
            windows[origin] = initWindow();
        }
        if (windows[origin].hasGUMPermission || windows[origin].hasPCPermission) {
            // permission already granted
            return origReceiveMessage.call(this, msg);
        } else {
            windows[origin].pending.push({
                callID: request.callID,
                windowID: request.windowID,
                messageManager: msg.target.messageManager
            });
            var browserWindow = msg.target.ownerDocument.defaultView;
            browserWindow.PopupNotifications.show(msg.target,
                'webrtc-datachannel',
                'Allow WebRTC P2P networking for ' + origin,
                null,
                {
                    label: 'Allow',
                    accessKey: 'a',
                    callback: function() {
                        windows[origin].hasPCPermission = true;
                        notifyPending(windows[origin].pending, 'rtcpeer:Allow');
                        windows[origin].pending = [];
                    }
                },
                [
                    {
                        label: 'Deny',
                        accessKey: 'd',
                        callback: function() {
                            windows[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            windows[origin].hasGUMPermission = false;

                            notifyPending(windows[origin].pending, 'rtcpeer:Deny');
                            windows[origin].pending = [];
                        }
                    },
                    {
                        label: 'Always allow',
                        accessKey: 'A',
                        callback: function() {
                            windows[origin].hasPCPermission = true;
                            notifyPending(windows[origin].pending, 'rtcpeer:Allow');
                            windows[origin].pending = [];
                            // FIXME: persist
                        }
                    },
                    {
                        label: 'Always deny when no camera permission is asked',
                        accessKey: 'w',
                        callback: function() {
                            console.log('no');
                            windows[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            windows[origin].hasGUMPermission = false;
                            notifyPending(windows[origin].pending, 'rtcpeer:Deny');
                            windows[origin].pending = [];
                            // FIXME: persist
                            // FIXME: actually implement this which is currently the default behaviour
                        }
                    },
                    {
                        label: 'Always deny',
                        accessKey: 'D',
                        callback: function() {
                            console.log('no');
                            windows[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            windows[origin].hasGUMPermission = false;
                            notifyPending(windows[origin].pending, 'rtcpeer:Deny');
                            windows[origin].pending = [];
                            // FIXME: persist
                        }
                    }
                ]
            );
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
        }
        windows[origin].hasGUMPermission = request.camera || request.microphone;
        return origReceiveMessage.call(this, msg);
    default:
        return origReceiveMessage.call(this, msg);
    }
};

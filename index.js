let { Cu } = require('chrome');
let { webrtcUI } = Cu.import('resource:///modules/webrtcUI.jsm', {});

var origins = {};
function initOrigin() {
    return {
        hasPCPermission: false,
        hasGUMPermission: false,
        pending: []
    };
}

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
    var origin;
    var request;
    switch(msg.name) {
    case 'rtcpeer:Request': 
        origin = msg.target.contentPrincipal.origin;
        request = msg.data;
        // permissions are per-origin
        if (!origins[origin]) {
            origins[origin] = initOrigin();
        }
        if (origins[origin].hasGUMPermission || origins[origin].hasPCPermission) {
            // Permission has already been granted.
            // Assumes GUM permission implies network permission.
            return origReceiveMessage.call(this, msg);
        } else {
            origins[origin].pending.push({
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
                        origins[origin].hasPCPermission = true;
                        notifyPending(origins[origin].pending, 'rtcpeer:Allow');
                        origins[origin].pending = [];
                    }
                },
                [
                    {
                        label: 'Deny',
                        accessKey: 'd',
                        callback: function() {
                            origins[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            origins[origin].hasGUMPermission = false;

                            notifyPending(origins[origin].pending, 'rtcpeer:Deny');
                            origins[origin].pending = [];
                        }
                    },
                    {
                        label: 'Always allow',
                        accessKey: 'A',
                        callback: function() {
                            origins[origin].hasPCPermission = true;
                            notifyPending(origins[origin].pending, 'rtcpeer:Allow');
                            origins[origin].pending = [];
                            // FIXME: persist
                        }
                    },
                    {
                        label: 'Always deny when no camera permission is asked',
                        accessKey: 'w',
                        callback: function() {
                            origins[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            origins[origin].hasGUMPermission = false;
                            notifyPending(origins[origin].pending, 'rtcpeer:Deny');
                            origins[origin].pending = [];
                            // FIXME: persist
                            // FIXME: actually implement this which is currently the default behaviour
                        }
                    },
                    {
                        label: 'Always deny',
                        accessKey: 'D',
                        callback: function() {
                            origins[origin].hasPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            origins[origin].hasGUMPermission = false;
                            notifyPending(origins[origin].pending, 'rtcpeer:Deny');
                            origins[origin].pending = [];
                            // FIXME: persist
                        }
                    }
                ]
            );
        }
        break;
    case 'rtcpeer:CancelRequest':
        // happens when navigating away (soon also on closing the pc)
        // msg.data contains callid which is unique
        Object.keys(origins).forEach(function (origin) {
            if (origin.pending && origin.pending.indexOf(msg.data) !== -1) {
                origin.pending.splice(origin.pending.indexOf(msg.data, 1)); 
            }
        });
        break;
    case 'webrtc:UpdateBrowserIndicators':
        // when browser indicators are updated this implies that GUM permission has 
        // been granted (which is easier than hooking webrtc:Allow or Deny by fiddling 
        // with the mm)
        origin = msg.target.contentPrincipal.origin;
        request = msg.data;

        if (!origins[origin]) {
            origins[origin] = initOrigin();
        }
        origins[origin].hasGUMPermission = request.camera || request.microphone;
        return origReceiveMessage.call(this, msg);
    default:
        return origReceiveMessage.call(this, msg);
    }
};

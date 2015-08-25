let { Cu } = require('chrome');
let { webrtcUI } = Cu.import('resource:///modules/webrtcUI.jsm', {});
var pref = require('sdk/preferences/service');
var PREFKEY = 'extensions.@webrtc-plumber.settings';


var origins = {};
function initOrigin() {
    return {
        hasPersistentPCPermission: null, // boolean, with null check
        temporaryPCPermissions: [], // list of inner window ids
        hasGUMPermission: false,
        pending: []
    };
}

function notifyPending(pending, message, windowid) {
    pending.forEach(function (request) {
        if (request.innerWindowID === windowid || windowid === undefined) {
            request.messageManager.sendAsyncMessage(message, {
                callID: request.callID,
                windowID: request.windowID
            });
        }
    });
}

function saveOriginPermissions() {
    var value = {};
    Object.keys(origins).forEach(function (origin) {
        console.log('yay?', origins[origin].hasPersistentPCPermission !== null);
        if (origins[origin].hasPersistentPCPermission !== null) {
            value[origin] = origins[origin].hasPersistentPCPermission;
        }
    });
    pref.set(PREFKEY, JSON.stringify(value));
}
function loadOriginPermissions() {
    var value = pref.get(PREFKEY);
    try {
        value = JSON.parse(value);
        Object.keys(value).forEach(function (origin) {
            origins[origin] = initOrigin();
            origins[origin].hasPersistentPCPermission = value[origin];
        });
    } catch(e) {
    }
}
loadOriginPermissions();

// overriding receiveMessage here as indicated in
// http://hg.mozilla.org/mozilla-central/file/beb9cc29efb9/browser/modules/webrtcUI.jsm#l170
var origReceiveMessage = webrtcUI.receiveMessage;
webrtcUI.receiveMessage = function(msg) {
    var origin;
    var request;
    var secure = false;
    switch(msg.name) {
    case 'rtcpeer:Request': 
        origin = msg.target.contentPrincipal.origin;
        secure = origin.indexOf('https:') === 0;
        request = msg.data;
        // permissions are per-origin
        if (!origins[origin]) {
            origins[origin] = initOrigin();
        }
        if (origins[origin].hasGUMPermission === true
          || origins[origin].hasPersistentPCPermission === true
          || origins[origin].temporaryPCPermissions.indexOf(request.innerWindowID) !== -1
            ) {
            // Permission has already been granted.
            // Assumes GUM permission implies network permission.
            return origReceiveMessage.call(this, msg);
        } else if (origins[origin].hasPersistentPCPermission !== false) {
            origins[origin].pending.push({
                callID: request.callID,
                windowID: request.windowID,
                innerWindowID: request.innerWindowID,
                messageManager: msg.target.messageManager
            });

            // show doorhanger -- FIXME: only once?
            var browserWindow = msg.target.ownerDocument.defaultView;
            var questions = [
                {
                    label: 'Allow',
                    accessKey: 'a',
                    callback: function() {
                        origins[origin].temporaryPCPermissions.push(request.innerWindowID);
                        notifyPending(origins[origin].pending, 'rtcpeer:Allow', request.innerWindowID);
                        origins[origin].pending = [];
                    }
                },
                {
                    label: 'Deny',
                    accessKey: 'd',
                    callback: function() {
                        // resetting so we don't get further requests
                        origins[origin].hasPersistentPCPermission = false;
                        notifyPending(origins[origin].pending, 'rtcpeer:Deny', request.innerWindowID);
                        origins[origin].pending = [];
                    }
                }
            ]
            if (secure) {
                questions.push(
                    {
                        label: 'Always allow',
                        accessKey: 'l',
                        callback: function() {
                            origins[origin].hasPersistentPCPermission = true;
                            origins[origin].hasTemporaryPCPermission = []; // reset to save memory
                            notifyPending(origins[origin].pending, 'rtcpeer:Allow');
                            origins[origin].pending = [];
                            saveOriginPermissions();
                        }
                    },
                    {
                        label: 'Always deny',
                        accessKey: 'w',
                        callback: function() {
                            origins[origin].hasPersistentPCPermission = false;
                            // this revokes the GUM grant currently just to be on the safe side
                            origins[origin].hasGUMPermission = false;
                            notifyPending(origins[origin].pending, 'rtcpeer:Deny');
                            origins[origin].pending = [];
                            saveOriginPermissions();
                        }
                    }
                );
            }
            browserWindow.PopupNotifications.show(msg.target,
                'webrtc-datachannel',
                'Allow WebRTC peer networking for ' + origin,
                null,
                questions.shift(),
                questions
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



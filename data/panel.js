function makeAvailable(enable) {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].id === 'checkbox-webrtc') continue;
        inputs[i].disabled = !enable;
    }
}

document.getElementById('checkbox-webrtc').onclick = function () {
    var enabled = document.getElementById('checkbox-webrtc').checked;
    self.port.emit('check-webrtc', enabled);
    makeAvailable(enabled);
}

self.port.on('check-webrtc', function(value) {
    document.getElementById('checkbox-webrtc').checked = value;
    makeAvailable(value);
});

document.getElementById('checkbox-iceservers').onclick = function () {
    var url = document.getElementById('url').value;

    self.port.emit('check-iceservers', {
        forceIce: document.getElementById('checkbox-iceservers').checked,
        urls: url !== "" ? [url] : [],
        username: document.getElementById('username').value,
        credential: document.getElementById('credential').value
    });
}

self.port.on('rtcpeer:Request', function(request) {
    var sites = document.getElementById('allowed-sites');

    /*
    var container = document.createElement('div');
    var label = document.createElement('label');
    label.appendChild(document.createTextNode('Allow ' + request.uri));
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';

    container.appendChild(label);
    container.appendChild(checkbox);
    sites.appendChild(container);
    checkbox.onclick = function () {
        console.log('change permission for', request.uri);
        self.port.emit('rtcpeer:Allow', { uri: request.uri });

        // since we can't revoke...
        checkbox.disabled = true;
    };
    */

    // alternative allow-deny approach
    var container = document.createElement('div');
    var label = document.createElement('label');
    label.appendChild(document.createTextNode('Allow ' + request.uri));

    var allow = document.createElement('button');
    allow.appendChild(document.createTextNode('Y'));
    allow.onclick = function () {
        self.port.emit('rtcpeer:Allow', { uri: request.uri });
        sites.removeChild(container); // maybe replace?
    };
    var deny = document.createElement('button');
    deny.appendChild(document.createTextNode('N'));
    deny.onclick = function () {
        self.port.emit('rtcpeer:Deny', { uri: request.uri });
        sites.removeChild(container); // maybe replace?
    };

    container.appendChild(label);
    container.appendChild(allow);
    container.appendChild(deny);
    sites.appendChild(container);
});

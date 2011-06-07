(function() {
var def = require_joo(),
    EventEmitter = app.framework.EventEmitter,
    BoundMethod = app.framework.BoundMethod;

function SocketManager() {
    this.socket = null;
    this.reloadUrl = null;
}
def(SocketManager).as('app.model.SocketManager').
it.borrows(EventEmitter, BoundMethod).
it.provides({
    isAlive: function() {
        return (this.socket && this.socket.readyState == WebSocket.OPEN);
    },
    getReloadUrl: function() {
        return this.reloadUrl;
    },
    connect: function(url) {
        try {
            this.socket = new WebSocket(url);
        } catch (e) {
            this.emit('error');
            this.reloadUrl = null;
            return;
        }
        this.socket.addEventListener('error', this.bound('onError'), false);
        this.socket.addEventListener('message', this.bound('onOpen'), false);
        this.socket.addEventListener('close', this.bound('onClose'), false);
    },
    close: function() {
        this.socket.close();
        this.reloadUrl = null;
        delete this.socket;
        this.emit('close');
    },
    send: function(msg) {
        if (this.isAlive()) this.socket.send(msg);
    },
    onOpen: function(event) {
        this.reloadUrl = event.data;
        this.socket.removeEventListener('message', this.bound('onOpen'));
        this.socket.addEventListener('message', this.bound('onMessage'), false);
        this.emit('open', event);
    },
    onError: function(event) {
        this.reloadUrl = null;
        this.emit('error', event);
    },
    onClose: function(event) {
        this.reloadUrl = null;
        this.emit('close', event);
    },
    onMessage: function(event) {
        this.emit('message', event);
    }
});

function ButtonView() {
    this.button = document.getElementById('toggle_button');
    this.button.addEventListener('click', this.bound('toggleButtonClicked'));
    this.state = ButtonView.STATE.OFF;
}
def(ButtonView).as('app.view.ButtonView').
it.borrows(EventEmitter, BoundMethod).
it.hasStatic({
    STATE: {
        ON: 1,
        OFF: 0
    }
}).
it.provides({
    turnOn: function() {
        this.state = ButtonView.STATE.ON;
        this.button.title = 'Click to disable.';
        this.button.className = 'on';
        return this;
    },
    turnOff: function() {
        this.state = ButtonView.STATE.OFF;
        this.button.title = 'Click to enable.';
        this.button.className = 'off';
        return this;
    },
    toggle: function() {
        return this.state === ButtonView.STATE.ON ? this.turnOff() : this.turnOn();
    },
    toggleButtonClicked: function() {
        this.emit('toggle', !this.state);
    }
});

function URLView() {
    this.box = document.getElementById('reload_url');
    this.box.addEventListener('click', this.bound('boxClicked'));
    this.icon = document.getElementById('clipboard_icon');
    this.icon.addEventListener('click', this.bound('iconClicked'));
}
def(URLView).as('app.view.URLView').
it.borrows(EventEmitter, BoundMethod).
it.provides({
    fill: function(url) {
        if (!url) return;
        this.box.value = url.toString();
        this.box.disabled = false;
        this.icon.style.display = 'block';
        this.emit('filled', url);
        return this;
    },
    empty: function() {
        this.box.value = '';
        this.box.disabled = true;
        this.icon.style.display = 'none';
        this.emit('emptied');
        return this;
    },
    select: function() {
        this.box.select();
        this.emit('selected');
        return this;
    },
    copy: function() {
    },
    boxClicked: function() {
        if (this.box.value) this.emit('copy');
    },
    iconClicked: function() {
        this.emit('copy');
    }
});

function PopupViewController() {
    // model
    this.socketManager = chrome.extension.getBackgroundPage().getSocketManager();

    // views
    this.button = new app.view.ButtonView();
    this.url = new app.view.URLView();
}
def(PopupViewController).as('app.controller.PopupViewController').
it.borrows(BoundMethod).
it.provides({
    route: function() {
        this.button.on('toggle', this.bound('toggleAction'));
        this.url.on('filled', this.bound('urlFilledAction'));
        this.url.on('emptied', this.bound('urlEmptiedAction'));
        this.url.on('selected', this.bound('urlSelectedAction'));
        this.url.on('copy', this.bound('copyAction'));
        this.socketManager.on('open', this.bound('socketOpenAction'));
        this.socketManager.on('message', this.bound('socketMessageAction'));
        this.socketManager.on('error', this.bound('socketErrorAction'));
        this.socketManager.on('close', this.bound('socketClosedAction'));
        return this;
    },
    run: function() {
        if (this.socketManager.isAlive()) {
            this.button.turnOn();
            this.url.fill(this.socketManager.getReloadUrl());
        } else {
            this.button.turnOff();
            this.url.empty();
        }
        return this;
    },
    toggleAction: function(state) {
        this.button.toggle();
        if (state) this.socketManager.connect('ws://sandbox.io:8800/');
        else this.socketManager.close();
    },
    copyAction: function() {
        this.url.select();
        this.url.copy();
    },
    urlEmptiedAction: function() {},
    urlFilledAction: function(url) {
    },
    urlSelectedAction: function() {},
    socketOpenAction: function() {
        this.url.fill(this.socketManager.getReloadUrl());
    },
    socketMessageAction: function() {
    },
    socketErrorAction: function() {
        this.button.turnOff();
        this.url.empty();
    },
    socketClosedAction: function() {
        this.button.turnOff();
        this.url.empty();
        //webkitNotifications.createHTMLNotification('notification.html').show();
    }
});



function BackgroundViewController(socketManager) {
    this.socketManager = socketManager;
    this.timer = new app.framework.Timer(60000);
}
def(BackgroundViewController).as('app.controller.BackgroundViewController').
it.borrows(BoundMethod).
it.provides({
    route: function() {
        this.socketManager.on('open', this.bound('onOpen'));
        this.socketManager.on('close', this.bound('onClose'));
        this.socketManager.on('error', this.bound('onError'));
        this.socketManager.on('message', this.bound('onMessage'));
        this.timer.on('tick', this.bound('heartBeat'));
        return this;
    },
    run: function() {
        return this;
    },
    heartBeat: function() {
        this.socketManager.send('heart beat');
    },
    onOpen: function() {
        chrome.browserAction.setIcon({path: '/assets/img/icon_on.png'});
    },
    onClose: function() {
        chrome.browserAction.setIcon({path: '/assets/img/icon_off.png'});
    },
    onError: function() {
        chrome.browserAction.setIcon({path: '/assets/img/icon_off.png'});
    },
    onMessage: function() {
        chrome.tabs.getSelected(null, function(tab) {
            chrome.tabs.executeScript(tab.id, {code: 'location.reload()'});
        });
    }
});
})();

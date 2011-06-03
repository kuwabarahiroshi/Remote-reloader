// url.value = localStorage.getItem('io.sandbox.remoteReloader.url') || url.value;

// b.addEventListener('click', function() {
//     chrome.extension.getBackgroundPage().createConnection().then(onConnection);
// }, false);
(function() {
var def = use_simple_class_declaration(),
    EventEmitter = app.framework.EventEmitter,
    BoundMethod = app.framework.BoundMethod,
    Configurable = app.framework.Configurable;

function SocketManager() {
    this.socket = null;
}
def(SocketManager).as('app.model.SocketManager').
it.borrows(EventEmitter, BoundMethod).
it.provides({
    isAlive: function() {
        return (this.socket && this.socket.readyState == WebSocket.OPEN);
    },
    connect: function(url) {
        try {
            this.socket = new WebSocket(url);
        } catch (e) {
            this.emit('error');
            return;
        }
        this.socket.addEventListener('error', this.bound('onError'), false);
        this.socket.addEventListener('message', this.bound('onOpen'), false);
        this.socket.addEventListener('close', this.bound('onClose'), false);
    },
    close: function() {
        delete this.socket;
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

function ButtonView(id) {
    this.button = document.getElementById(id);
    this.state = ButtonView.STATE.OFF;
    this.button.addEventListener('click', this.bound('toggle'), false);
}
def(ButtonView).as('app.view.ButtonView').
it.hasStatic({
    STATE: {
        ON: 1,
        OFF: 0
    }
}).
it.borrows(EventEmitter, BoundMethod, Configurable).
it.provides({
    switchTurnOn: function() {
        this.state = ButtonView.STATE.ON;
        this.draw();
        this.emit('switchon');
        return this;
    },
    switchTurnOff: function() {
        this.state = ButtonView.STATE.OFF;
        this.draw();
        this.emit('switchoff');
        return this;
    },
    stateTurnOn: function() {
        this.state = ButtonView.STATE.ON;
        this.draw();
        return this;
    },
    stateTurnOff: function() {
        this.state = ButtonView.STATE.OFF;
        this.draw();
        return this;
    }
    draw: function() {
        if (this.state == ButtonView.STATE.ON) {
            this.button.title = 'Click to disable.';
            this.button.className = 'on';
        } else {
            this.button.title = 'Click to enable.';
            this.button.className = 'off';
        }
        return this;
    },
    toggle: function() {
        return this.state === ButtonView.STATE.ON ? this.switchOff() : this.switchOn();
    }
});

function URLView(config) {
    this.configure(config);
    this.box = document.getElementById(this.config.urlbox_id);
    this.icon = document.getElementById(this.config.icon_id);
    this.icon.addEventListener('click', function(event) {this.emit('icon_clicked', event);});
    this.init();
}
def(URLView).as('app.view.URLView').
it.borrows(EventEmitter, Configurable)
it.provides({
    _default: {
        urlbox_id: 'reload_url',
        icon_id: 'clipboard_icon'
    },
    fill: function(url) {
        this.box.value = url.toString();
        this.icon.style.display = 'block';
        this.emit('filled');
        return this;
    },
    empty: function() {
        this.box.value = '';
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
        this.emit('copied');
        return this;
    }
});

function PopupViewController() {
    // model
    this.socketManager = chrome.extension.getBackgroundPage().getSocketManager();

    // views
    this.button = this.container.get('view.button');
    this.url = this.container.get('view.url');

    // initialize
    this.init();

    // routing
    this.route();
}
def(PopupViewController).as('app.controller.PopupViewController').
it.borrows(BoundMethod).
it.provides({
    init: function() {
        this.socketManager.isAlive() ? this.button.stateTurnOn() : this.button.stateTurnOff();
        this.url.fill(this.socketManager.getReloadUrl());
    },
    route: function() {
        this.button.on('switchon', this.bound('switchOnActon'));
        this.button.on('switchoff', this.bound('switchOffAction'));
        this.url.on('filled', this.bound('urlFilledAction'));
        this.url.on('emptied', this.bound('urlEmptiedAction'));
        this.url.on('selected', this.bound('urlSelectedAction'));
        this.socketManager.on('open', this.bound('socketOpendAction'));
        this.socketManager.on('message', this.bound('socketMessageAction'));
        this.socketManager.on('error', this.bound('socketErrorAction'));
        this.socketManager.on('close', this.bound('socketClosedAction'));
    },
    switchOnAction: function() {
        this.socketManager.connect(this.container.get('socket.url'));
    },
    switchOffAction: function() {
        this.socketManager.close();
    },
    socketOpenAction: function() {
        this.url.fill(this.socketManager.getReloadUrl());
    },
    socketMessageAction: function() {
        chrome.tabs.getSelected(null, function(tab) {
            chrome.tabs.executeScript(tab.id, {code: 'location.reload()'});
        });
    },
    socketErrorAction: function() {
    },
    socketClosedAction: function() {
        webkitNotifications.createHTMLNotification('notification.html').show();
        chrome.browserAction.setIcon({path: 'icon_on.png'});
        chrome.browserAction.setIcon({path: 'icon_off.png'});
    }
});

PopupViewController.prototype = Object.create(Configurable, UsingBoundMethod, {
});
})();



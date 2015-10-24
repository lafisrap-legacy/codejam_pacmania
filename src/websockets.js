$WS = {
    _websocket: null,
    _connected: false,
    _callbacks: [],
    _openCallback: null,
    _messageCallback: null,
    _timeOffset: null,

    connect: function(addr, cb, messageCb) {

        var self = this;

        try {
            this._websocket = new WebSocket(addr);
        } catch(e) {
            cc.log("WebSocket connection to \""+addr+"\" failed.");
            return false;
        }

        this._websocket.onopen = function(evt) { self.onOpen(evt) };
        this._websocket.onmessage = function(evt) { self.onMessage(evt); };
        this._websocket.onerror = function(evt) { self.onError(evt); };
        this._websocket.onclose = function(evt) { self.onClose(evt); };       
    
        this.getId = this.idFactory();

        this._openCallback = cb;
        this._messageCallback = messageCb;

        reg = /value=\"([^\"]+)\"/g;
    },

    onOpen: function(evt) {
        this._connected = true;
        if( this._openCallback ) {
            this._openCallback();
            this._openCallback = null;
        }
    },

    onMessage: function(evt) {

        try {
            var data = JSON.parse(evt.data);
        } catch (e) {
            throw "onMessage: parse json message failed (" + e + ")";
        }

         if( data.Id && this._callbacks[data.Id] ) {
            var id = data.Id;
            delete data.Id;
            this._callbacks[id](data);
        } else if( data.Command ) {
            if( this._messageCallback ) this._messageCallback(data);
        }
    },

    setTimeOffset: function(serverTime) {
        this._timeOffset = new Date().getTime() - serverTime;
    },

    getServerTime: function(time) {
        return (time || new Date().getTime()) - this._timeOffset;
    },

    onError: function(evt) {
        this._connected = false;
        console.error("A websockets error occured.")
    },

    onClose: function(evt) {
        this._connected = false;
        console.log("Websockets connection closed.")
    },

    sendMessage: function( message, cb ) {
        if( !this._connected ) return;

        message = message || {};
        message.Id = this.getId();

        this._websocket.send(JSON.stringify(message));		
        this._callbacks[message.Id] = cb;
    },

    idFactory: function() {
        var id = 1000;

        return function() {
            return ++id;
        }
    },
    getId: null,
}

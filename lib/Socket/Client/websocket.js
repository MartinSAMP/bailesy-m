import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';

// Polyfill WebSocket for Node.js
let WebSocketImpl;
if (typeof WebSocket === 'undefined') {
    // Node.js environment - use ws library
    try {
        const ws = await import('ws');
        WebSocketImpl = ws.default || ws.WebSocket;
    } catch (error) {
        throw new Error('WebSocket is not available. Please install "ws" package: npm install ws');
    }
} else {
    // Bun or browser environment - use native WebSocket
    WebSocketImpl = WebSocket;
}

export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
        this._readyState = 3;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
        this.reconnectDelay = this.config.reconnectDelay || 1000;
        this.maxReconnectDelay = this.config.maxReconnectDelay || 30000;
        this.reconnectTimer = null;
        this.shouldReconnect = false;
        this.messageQueue = [];
        this.maxQueueSize = this.config.maxQueueSize || 100;
        this.pingInterval = null;
        this.pingTimeout = null;
        this.lastPongTime = null;
    }

    get isOpen() {
        return this._readyState === 1; // OPEN
    }

    get isClosed() {
        return this.socket === null || this._readyState === 3; // CLOSED
    }

    get isClosing() {
        return this.socket === null || this._readyState === 2; // CLOSING
    }

    get isConnecting() {
        return this._readyState === 0; // CONNECTING
    }

    connect() {
        if (this.socket) {
            return;
        }

        this.shouldReconnect = true;
        this._readyState = 0;

        const headers = {
            'Origin': DEFAULT_ORIGIN,
            ...(this.config.options?.headers || {})
        };

        this.socket = new WebSocketImpl(this.url, {
            headers
        });

        this.socket.onopen = (event) => {
            this._readyState = 1;
            this.reconnectAttempts = 0;
            this.emit('open', event);
            this.flushMessageQueue();
            this.startHeartbeat();
        };

        this.socket.onmessage = (event) => {
            this.lastPongTime = Date.now();
            this.emit('message', event.data);
        };

        this.socket.onerror = (event) => {
            this.emit('error', event);
        };

        this.socket.onclose = (event) => {
            this._readyState = 3;
            this.stopHeartbeat();
            this.emit('close', event.code, event.reason);
            this.socket = null;
            
            if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.emit('reconnect-failed', this.reconnectAttempts);
            }
        };

        if (this.config.connectTimeoutMs) {
            const timeout = setTimeout(() => {
                if (this._readyState === 0) {
                    this.close();
                    this.emit('error', new Error('Connection timeout'));
                }
            }, this.config.connectTimeoutMs);

            const originalOnOpen = this.socket.onopen;
            this.socket.onopen = (event) => {
                clearTimeout(timeout);
                if (originalOnOpen) originalOnOpen.call(this.socket, event);
            };
        }
    }

    close() {
        if (!this.socket) {
            return;
        }

        this.shouldReconnect = false;
        this.clearReconnectTimer();
        this.stopHeartbeat();
        this._readyState = 2;
        this.socket.close();
        this.socket = null;
        this._readyState = 3;
    }

    send(str, cb) {
        if (!this.socket || this._readyState !== 1) {
            if (this.config.queueMessages && this.messageQueue.length < this.maxQueueSize) {
                this.messageQueue.push({ data: str, callback: cb });
                return true;
            }
            if (cb) cb(new Error('WebSocket is not open'));
            return false;
        }

        try {
            this.socket.send(str);
            if (cb) cb();
            return true;
        } catch (error) {
            if (cb) cb(error);
            return false;
        }
    }

    scheduleReconnect() {
        this.clearReconnectTimer();
        
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        
        this.reconnectAttempts++;
        this.emit('reconnecting', this.reconnectAttempts, delay);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this._readyState === 1) {
            const { data, callback } = this.messageQueue.shift();
            this.send(data, callback);
        }
    }

    startHeartbeat() {
        if (!this.config.heartbeatInterval) return;
        
        this.stopHeartbeat();
        this.lastPongTime = Date.now();
        
        this.pingInterval = setInterval(() => {
            if (this._readyState === 1) {
                const timeSinceLastPong = Date.now() - this.lastPongTime;
                
                if (timeSinceLastPong > (this.config.heartbeatTimeout || 30000)) {
                    this.emit('heartbeat-timeout');
                    this.socket.close();
                }
            }
        }, this.config.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
    }

    getConnectionStats() {
        return {
            readyState: this._readyState,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            lastPongTime: this.lastPongTime,
            isHealthy: this.lastPongTime ? (Date.now() - this.lastPongTime) < 60000 : false
        };
    }

    resetReconnectAttempts() {
        this.reconnectAttempts = 0;
    }
}
//# sourceMappingURL=websocket.js.map
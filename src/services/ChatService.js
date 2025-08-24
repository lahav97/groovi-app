// Configuration Constants
const CONFIG = {
    WEBSOCKET_URL: 'wss://znl6lhqw3a.execute-api.us-east-1.amazonaws.com/production',
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    PING_INTERVAL: 5 * 60 * 1000, // 5 minutes
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_BASE_DELAY: 1000, // 1 second
    RECONNECT_MAX_DELAY: 30000, // 30 seconds
    MESSAGE_TIMEOUT: 15000, // 15 seconds for message responses
};

import Logger from '../utils/Logger';

const logger = Logger.createLogger('ChatService');

// Connection States
const CONNECTION_STATES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed'
};

/**
 * ChatService Class
 * Handles all WebSocket communication and state management
 */
class ChatService {
    constructor() {
        // Connection Management
        this.ws = null;
        this.username = null;
        this.connectionState = CONNECTION_STATES.DISCONNECTED;
        this.connectionError = null;
        this.connectionPromise = null;

        // Reconnection Logic
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
        this.isIntentionalDisconnect = false;

        // Keep-Alive Management
        this.pingInterval = null;
        this.lastPingTime = null;
        this.lastPongTime = null;

        // Event Listeners
        this.eventListeners = {
            message: new Set(),
            chatList: new Set(),
            userStatus: new Set(),
            connection: new Set(),
            error: new Set()
        };

        // Request/Response Tracking
        this.pendingRequests = new Map();
        this.requestCounter = 0;

        // Performance Monitoring
        this.metrics = {
            messagesReceived: 0,
            messagesSent: 0,
            connectionAttempts: 0,
            reconnectionCount: 0,
            lastConnectTime: null,
            averageLatency: 0
        };

        // Debug Mode
        this.debugMode = __DEV__ || false;

        // Bind methods to maintain context
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
        this.handleWebSocketOpen = this.handleWebSocketOpen.bind(this);
        this.handleWebSocketClose = this.handleWebSocketClose.bind(this);
        this.handleWebSocketError = this.handleWebSocketError.bind(this);

        logger.info('ChatService initialized');
    }

    // ===================================
    // LOGGING SYSTEM
    // ===================================

    /**
     * Professional logging system with levels and formatting
     * @param {string} level - Log level (error, warn, info, debug)
     * @param {string} message - Log message
     * @param {object} data - Optional data to log
     */
    log(level, message, data = null) {
        switch (level) {
            case 'error':
                logger.error(message, data);
                break;
            case 'warn':
                logger.warn(message, data);
                break;
            case 'info':
                logger.info(message, data);
                break;
            case 'debug':
                logger.debug(message, data);
                break;
            default:
                logger.info(message, data);
        }
    }

    // ===================================
    // CONNECTION MANAGEMENT
    // ===================================

    /**
     * Connect to WebSocket server with username
     * @param {string} username - User's username for connection
     * @returns {Promise<void>} Resolves when connected successfully
     */
    async connectUserToWebSocket(username) {
        // Validation
        if (!username || typeof username !== 'string' || !username.trim()) {
            const error = new Error('Invalid username provided');
            this.log('error', 'Connection failed: Invalid username', { username });
            throw error;
        }

        const cleanUsername = username.trim();

        // Prevent duplicate connections
        if (this.connectionState === CONNECTION_STATES.CONNECTING) {
            this.log('warn', 'Connection already in progress, waiting...');
            return this.connectionPromise;
        }

        if (this.connectionState === CONNECTION_STATES.CONNECTED && this.username === cleanUsername) {
            this.log('info', 'Already connected with same username');
            return Promise.resolve();
        }

        // Clean up existing connection
        if (this.ws) {
            this.log('info', 'Closing existing connection before reconnecting');
            await this.disconnectFromWebSocket();
        }

        // Set connection state
        this.username = cleanUsername;
        this.connectionState = CONNECTION_STATES.CONNECTING;
        this.connectionError = null;
        this.isIntentionalDisconnect = false;
        this.metrics.connectionAttempts++;

        // Create connection promise
        this.connectionPromise = this._establishWebSocketConnection();

        try {
            await this.connectionPromise;
            this.log('info', 'Successfully connected to WebSocket', { username: cleanUsername });
            return;
        } catch (error) {
            this.log('error', 'Failed to connect to WebSocket', { error: error.message, username: cleanUsername });
            throw error;
        } finally {
            this.connectionPromise = null;
        }
    }

    /**
     * Internal method to establish WebSocket connection
     * @private
     * @returns {Promise<void>}
     */
    _establishWebSocketConnection() {
        return new Promise((resolve, reject) => {
            try {
                // Construct WebSocket URL
                const wsUrl = `${CONFIG.WEBSOCKET_URL}?username=${encodeURIComponent(this.username)}`;
                this.log('debug', 'Creating WebSocket connection', { url: wsUrl });

                // Create WebSocket instance
                this.ws = new WebSocket(wsUrl);

                // Set up event handlers
                this.ws.onopen = (event) => {
                    this.handleWebSocketOpen(event);
                    resolve();
                };

                this.ws.onmessage = this.handleWebSocketMessage;
                this.ws.onclose = this.handleWebSocketClose;
                this.ws.onerror = (error) => {
                    this.handleWebSocketError(error);
                    reject(new Error(`WebSocket connection failed: ${error.message || 'Unknown error'}`));
                };

                // Connection timeout
                const timeoutId = setTimeout(() => {
                    if (this.connectionState === CONNECTION_STATES.CONNECTING) {
                        this.ws?.close();
                        const timeoutError = new Error(`Connection timeout after ${CONFIG.CONNECTION_TIMEOUT}ms`);
                        this.log('error', 'Connection timeout', { timeout: CONFIG.CONNECTION_TIMEOUT });
                        reject(timeoutError);
                    }
                }, CONFIG.CONNECTION_TIMEOUT);

                // Clear timeout on successful connection
                this.ws.addEventListener('open', () => clearTimeout(timeoutId), { once: true });

            } catch (error) {
                this.log('error', 'Failed to create WebSocket', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket with cleanup
     * @param {boolean} intentional - Whether this is an intentional disconnect
     * @returns {Promise<void>}
     */
    async disconnectFromWebSocket(intentional = true) {
        this.log('info', 'Disconnecting from WebSocket', { intentional });

        this.isIntentionalDisconnect = intentional;
        this.connectionState = CONNECTION_STATES.DISCONNECTED;

        // Stop ping interval
        this.stopPingInterval();

        // Cancel reconnection attempts
        this.cancelReconnection();

        // Close WebSocket connection
        if (this.ws) {
            try {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close(1000, 'Client disconnect');
                } else {
                    this.ws.close();
                }
            } catch (error) {
                this.log('warn', 'Error closing WebSocket', { error: error.message });
            }

            this.ws = null;
        }

        // Clear state
        this.username = null;
        this.connectionError = null;
        this.pendingRequests.clear();

        // Notify connection handlers
        this.notifyConnectionHandlers({
            state: CONNECTION_STATES.DISCONNECTED,
            connected: false,
            username: null,
            intentional
        });

        this.log('info', 'Successfully disconnected from WebSocket');
    }

    // ===================================
    // WEBSOCKET EVENT HANDLERS
    // ===================================

    /**
     * Handle WebSocket connection open
     * @private
     */
    handleWebSocketOpen(event) {
        this.log('info', 'WebSocket connection established');

        this.connectionState = CONNECTION_STATES.CONNECTED;
        this.connectionError = null;
        this.reconnectAttempts = 0;
        this.metrics.lastConnectTime = new Date().toISOString();

        // Start keep-alive pings
        this.startPingInterval();

        // Notify connection handlers
        this.notifyConnectionHandlers({
            state: CONNECTION_STATES.CONNECTED,
            connected: true,
            username: this.username
        });
    }

    /**
     * Handle WebSocket connection close
     * @private
     */
    handleWebSocketClose(event) {
        this.log('info', 'WebSocket connection closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            intentional: this.isIntentionalDisconnect
        });

        this.connectionState = CONNECTION_STATES.DISCONNECTED;
        this.stopPingInterval();

        // Notify connection handlers
        this.notifyConnectionHandlers({
            state: CONNECTION_STATES.DISCONNECTED,
            connected: false,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        // Handle reconnection for unexpected disconnects
        if (!this.isIntentionalDisconnect && !event.wasClean) {
            this.handleReconnection();
        }
    }

    /**
     * Handle WebSocket errors
     * @private
     */
    handleWebSocketError(error) {
        this.log('error', 'WebSocket error occurred', { error: error.message || error });

        this.connectionError = error.message || 'WebSocket error occurred';

        // Notify error handlers
        this.notifyErrorHandlers({
            type: 'websocket_error',
            message: this.connectionError,
            error
        });
    }

    /**
     * Handle incoming WebSocket messages
     * @private
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.log('debug', 'Received WebSocket message', { data });

            this.metrics.messagesReceived++;

            // Handle different message types (will be expanded later)
            this.processIncomingMessage(data);

        } catch (error) {
            this.log('error', 'Failed to parse WebSocket message', {
                error: error.message,
                rawData: event.data
            });
        }
    }

    // ===================================
    // KEEP-ALIVE SYSTEM
    // ===================================

    /**
     * Start the keep-alive ping interval
     * @private
     */
    startPingInterval() {
        this.stopPingInterval();

        this.log('debug', 'Starting ping interval', { interval: CONFIG.PING_INTERVAL });

        this.pingInterval = setInterval(() => {
            if (this.connectionState === CONNECTION_STATES.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
                this.sendKeepAlivePing();
            }
        }, CONFIG.PING_INTERVAL);
    }

    /**
     * Stop the keep-alive ping interval
     * @private
     */
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            this.log('debug', 'Ping interval stopped');
        }
    }

    /**
     * Send keep-alive ping to server
     * @private
     */
    sendKeepAlivePing() {
        if (!this.username) return;

        this.lastPingTime = Date.now();

        const pingPayload = {
            action: 'chat_keep_alive',
            username: this.username,
            timestamp: new Date().toISOString()
        };

        this.sendAction('chat_keep_alive', pingPayload);
        this.log('debug', 'Keep-alive ping sent');
    }

    // ===================================
    // RECONNECTION LOGIC
    // ===================================

    /**
     * Handle reconnection attempts with exponential backoff
     * @private
     */
    handleReconnection() {
        if (this.isIntentionalDisconnect || this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
            this.log('warn', 'Reconnection aborted', {
                intentional: this.isIntentionalDisconnect,
                attempts: this.reconnectAttempts,
                maxAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS
            });

            this.connectionState = CONNECTION_STATES.FAILED;
            this.notifyConnectionHandlers({
                state: CONNECTION_STATES.FAILED,
                connected: false,
                error: 'Max reconnection attempts reached'
            });
            return;
        }

        this.reconnectAttempts++;
        this.connectionState = CONNECTION_STATES.RECONNECTING;
        this.metrics.reconnectionCount++;

        // Calculate exponential backoff delay
        const delay = Math.min(
            CONFIG.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1),
            CONFIG.RECONNECT_MAX_DELAY
        );

        this.log('info', 'Scheduling reconnection attempt', {
            attempt: this.reconnectAttempts,
            delay,
            maxAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS
        });

        this.notifyConnectionHandlers({
            state: CONNECTION_STATES.RECONNECTING,
            connected: false,
            attempt: this.reconnectAttempts,
            maxAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS,
            delay
        });

        this.reconnectTimeout = setTimeout(async () => {
            if (!this.isIntentionalDisconnect && this.username) {
                try {
                    this.log('info', 'Attempting reconnection', { attempt: this.reconnectAttempts });
                    await this.connectUserToWebSocket(this.username);
                } catch (error) {
                    this.log('error', 'Reconnection attempt failed', {
                        attempt: this.reconnectAttempts,
                        error: error.message
                    });

                    // Schedule next attempt
                    this.handleReconnection();
                }
            }
        }, delay);
    }

    /**
     * Cancel ongoing reconnection attempts
     * @private
     */
    cancelReconnection() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
            this.log('debug', 'Reconnection cancelled');
        }
        this.reconnectAttempts = 0;
    }

    // ===================================
    // MESSAGE PROCESSING
    // ===================================

    /**
     * Process incoming messages (will be expanded with event listeners)
     * @private
     * @param {object} data - Parsed message data
     */
    processIncomingMessage(data) {
        const type = data?.type || 'unknown';
        this.log('debug', 'Processing incoming message', { type });

        switch (type) {
            // Chat list payloads from backend
            case 'chat_list':
            case 'conversations_list':
                this.notifyListeners(this.eventListeners.chatList, data);
                break;

            // Message payloads (history + realtime)
            case 'messages':
            case 'chat_history':
            case 'message_received':
                this.notifyListeners(this.eventListeners.message, data);
                break;

            // Presence / status
            case 'user_status':
                if (!this.eventListeners.userStatus) this.eventListeners.userStatus = new Set();
                this.notifyListeners(this.eventListeners.userStatus, data);
                break;

            // Fallback: deliver to message listeners so nothing is lost
            default:
                this.notifyListeners(this.eventListeners.message, data);
                break;
        }
    }

    /**
     * Send a message to another user
     * @param {string} to - Recipient username
     * @param {string} message - Message text
     * @returns {boolean} Success status
     */
    sendMessage(to, message) {
        if (!to || !message || typeof to !== 'string' || typeof message !== 'string') {
            this.log('warn', 'Invalid message parameters', { to, message });
            return false;
        }

        const cleanTo = to.trim();
        const cleanMessage = message.trim();

        if (!cleanTo || !cleanMessage) {
            this.log('warn', 'Empty message parameters after trimming');
            return false;
        }

        // Check connection
        if (!this.isConnected()) {
            this.log('warn', 'Cannot send message: not connected');
            return false;
        }

        // Create payload
        const messagePayload = {
            to: cleanTo,
            message: cleanMessage
        };

        // Send via existing sendAction method
        const success = this.sendAction('send_msg', messagePayload);

        // Log results
        if (success) {
            this.log('info', 'Message sent successfully', {
                to: cleanTo,
                preview: cleanMessage.substring(0, 50)
            });
        } else {
            this.log('error', 'Failed to send message', {
                to: cleanTo,
                preview: cleanMessage.substring(0, 50)
            });
        }

        return success;
    }

    /**
     * Send action to server with error handling
     * @param {string} action - Action name
     * @param {object} payload - Action payload
     * @returns {boolean} Success status
     */
    sendAction(action, payload = {}) {
        if (!this.isConnected()) {
            this.log('warn', 'Cannot send action: not connected', { action });
            return false;
        }

        const message = {
            action,
            ...payload
        };

        try {
            this.ws.send(JSON.stringify(message));
            this.metrics.messagesSent++;
            this.log('debug', 'Action sent successfully', { action, payload });
            return true;
        } catch (error) {
            this.log('error', 'Failed to send action', {
                action,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Load chat list from backend
     * @param {string} username - Username to load chats for
     * @returns {boolean} Success status
     */
    loadChatList(username) {
        if (!username || typeof username !== 'string') {
            this.log('warn', 'Invalid username for loadChatList', { username });
            return false;
        }

        if (!this.isConnected()) {
            this.log('warn', 'Cannot load chat list: not connected');
            return false;
        }

        const payload = {
            username: username.trim()
        };

        const success = this.sendAction('load_chatList', payload);

        if (success) {
            this.log('info', 'Chat list request sent', { username: username.trim() });
        } else {
            this.log('error', 'Failed to request chat list', { username: username.trim() });
        }

        return success;
    }

    /**
     * Load chat history between two users
     * @param {string} user1 - First user
     * @param {string} user2 - Second user
     * @returns {boolean} Success status
     */
    loadChatHistory(user1, user2) {
        if (!user1 || !user2 || typeof user1 !== 'string' || typeof user2 !== 'string') {
            this.log('warn', 'Invalid parameters for loadChatHistory', { user1, user2 });
            return false;
        }

        if (!this.isConnected()) {
            this.log('warn', 'Cannot load chat history: not connected');
            return false;
        }

        const payload = {
            user1: user1.trim(),
            user2: user2.trim()
        };

        const success = this.sendAction('chat_history', payload);

        if (success) {
            this.log('info', 'Chat history request sent', { user1: user1.trim(), user2: user2.trim() });
        } else {
            this.log('error', 'Failed to request chat history', { user1: user1.trim(), user2: user2.trim() });
        }

        return success;
    }

    // ===================================
    // STATE MANAGEMENT & UTILITIES
    // ===================================

    /**
     * Check if WebSocket is connected
     * @returns {boolean} Connection status
     */
    isConnected() {
        return this.connectionState === CONNECTION_STATES.CONNECTED &&
            this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get current connection state
     * @returns {object} Complete connection state
     */
    getConnectionState() {
        return {
            state: this.connectionState,
            connected: this.isConnected(),
            username: this.username,
            error: this.connectionError,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS,
            metrics: { ...this.metrics }
        };
    }

    // ===================================
    // EVENT HANDLER PLACEHOLDERS
    // ===================================
    // These will be implemented in the next phase

    /**
     * Add listener for incoming messages
     * @param {function} callback - Function to call when message received
     * @returns {function} Unsubscribe function
     */
    onMessage(callback) {
        if (typeof callback !== 'function') {
            this.log('warn', 'onMessage callback must be a function');
            return () => {};
        }

        this.eventListeners.message.add(callback);
        this.log('debug', 'Message listener added', { totalListeners: this.eventListeners.message.size });

        // Return unsubscribe function
        return () => {
            this.eventListeners.message.delete(callback);
            this.log('debug', 'Message listener removed', { totalListeners: this.eventListeners.message.size });
        };
    }

    /**
     * Add listener for chat list updates
     * @param {function} callback - Function to call when chat list updated
     * @returns {function} Unsubscribe function
     */
    onChatListUpdate(callback) {
        if (typeof callback !== 'function') {
            this.log('warn', 'onChatListUpdate callback must be a function');
            return () => {};
        }

        this.eventListeners.chatList.add(callback);
        this.log('debug', 'Chat list listener added', { totalListeners: this.eventListeners.chatList.size });

        // Return unsubscribe function
        return () => {
            this.eventListeners.chatList.delete(callback);
            this.log('debug', 'Chat list listener removed', { totalListeners: this.eventListeners.chatList.size });
        };
    }

    /**
     * Add listener for connection state changes
     * @param {function} callback - Function to call when connection changes
     * @returns {function} Unsubscribe function
     */
    onConnectionChange(callback) {
        if (typeof callback !== 'function') {
            this.log('warn', 'onConnectionChange callback must be a function');
            return () => {};
        }

        this.eventListeners.connection.add(callback);
        this.log('debug', 'Connection listener added', { totalListeners: this.eventListeners.connection.size });

        // Return unsubscribe function
        return () => {
            this.eventListeners.connection.delete(callback);
            this.log('debug', 'Connection listener removed', { totalListeners: this.eventListeners.connection.size });
        };
    }

    /**
     * Notify connection handlers
     * @private
     * @param {object} data - Connection state data
     */
    notifyConnectionHandlers(data) {
        this.log('debug', 'Connection state changed', data);

        // Notify all connection listeners
        this.eventListeners.connection.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                this.log('error', 'Error in connection callback', { error: error.message });
            }
        });
    }

    notifyListeners(set, payload) {
        set.forEach(cb => {
            try { cb(payload); } catch (e) { this.log('error', 'Listener error', { error: e.message }); }
        });
    }

    /**
     * Notify error handlers
     * @private
     * @param {object} error - Error data
     */
    notifyErrorHandlers(error) {
        this.log('debug', 'Error occurred', error);

        // Notify all error listeners
        this.eventListeners.error.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                this.log('error', 'Error in error callback', { error: err.message });
            }
        });
    }
}

// Export singleton instance
export default new ChatService();
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

import { createLogger } from '../utils/Logger';

const logger = createLogger('ChatService');

// Connection States
const CONNECTION_STATES = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed'
};

/**
 * ChatService Class - Handles WebSocket communication and state management
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

        logger.info('✅ ChatService initialized');
    }

    // ===================================
    // CONNECTION MANAGEMENT
    // ===================================

    /**
     * Connect to WebSocket server with username
     */
    async connectUserToWebSocket(username) {
        if (!username || typeof username !== 'string' || !username.trim()) {
            const error = new Error('Invalid username provided');
            logger.error('❌ Connection failed: Invalid username', { username });
            throw error;
        }

        const cleanUsername = username.trim();

        // Prevent duplicate connections
        if (this.connectionState === CONNECTION_STATES.CONNECTING) {
            logger.warn('⏳ Connection already in progress, waiting...');
            return this.connectionPromise;
        }

        if (this.connectionState === CONNECTION_STATES.CONNECTED && this.username === cleanUsername) {
            return Promise.resolve();
        }

        // Clean up existing connection
        if (this.ws) {
            logger.info('🔄 Closing existing connection before reconnecting');
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
            logger.info('✅ Successfully connected to WebSocket', { username: cleanUsername });
            return;
        } catch (error) {
            logger.error('❌ Failed to connect to WebSocket', { error: error.message, username: cleanUsername });
            throw error;
        } finally {
            this.connectionPromise = null;
        }
    }

    /**
     * Internal method to establish WebSocket connection
     */
    async _establishWebSocketConnection() {
        return new Promise(async (resolve, reject) => {
            try {
                let wsUrl = `${CONFIG.WEBSOCKET_URL}?username=${encodeURIComponent(this.username)}`;

                logger.info('🔗 Connecting to WebSocket', { username: this.username });

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
                        logger.error('⏰ Connection timeout', { timeout: CONFIG.CONNECTION_TIMEOUT });
                        reject(timeoutError);
                    }
                }, CONFIG.CONNECTION_TIMEOUT);

                // Clear timeout on successful connection
                this.ws.addEventListener('open', () => clearTimeout(timeoutId), { once: true });

            } catch (error) {
                logger.error('❌ Failed to create WebSocket', { error: error.message });
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket with cleanup
     */
    async disconnectFromWebSocket(intentional = true) {
        logger.info('🔌 Disconnecting from WebSocket', { intentional });

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
                logger.warn('⚠️ Error closing WebSocket', { error: error.message });
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
    }

    // ===================================
    // WEBSOCKET EVENT HANDLERS
    // ===================================

    handleWebSocketOpen(event) {
        logger.info('🟢 WebSocket connection established');

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

    handleWebSocketClose(event) {
        logger.info('🔴 WebSocket connection closed', {
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

    handleWebSocketError(error) {
        const errorMessage = error.message || error.toString() || 'Unknown WebSocket error';
        const errorType = this.classifyWebSocketError(errorMessage);

        logger.warn('⚠️ WebSocket error', {
            category: errorType.category,
            message: errorType.friendlyMessage,
            shouldReconnect: errorType.shouldReconnect
        });

        // Update connection state based on error type
        if (errorType.shouldReconnect && !this.isIntentionalDisconnect) {
            this.connectionState = CONNECTION_STATES.RECONNECTING;
            this.connectionError = `${errorType.category}: ${errorType.friendlyMessage}`;
        } else {
            this.connectionState = CONNECTION_STATES.FAILED;
            this.connectionError = errorType.friendlyMessage;
        }

        // Stop ping interval on error
        this.stopPingInterval();

        // Notify error handlers with classified error
        this.notifyErrorHandlers({
            type: 'websocket_error',
            category: errorType.category,
            message: errorType.friendlyMessage,
            originalError: errorMessage,
            shouldReconnect: errorType.shouldReconnect,
            error
        });

        // Notify connection handlers about the error state
        this.notifyConnectionHandlers({
            state: this.connectionState,
            connected: false,
            error: errorType.friendlyMessage,
            shouldReconnect: errorType.shouldReconnect
        });

        // Trigger reconnection for recoverable errors
        if (errorType.shouldReconnect && !this.isIntentionalDisconnect) {
            logger.info('🔄 Scheduling reconnection due to recoverable error');
            setTimeout(() => {
                if (!this.isIntentionalDisconnect && this.connectionState === CONNECTION_STATES.RECONNECTING) {
                    this.handleReconnection();
                }
            }, 1000);
        }
    }

    /**
     * Classify WebSocket errors to determine appropriate handling
     */
    classifyWebSocketError(errorMessage) {
        const message = errorMessage.toLowerCase();

        // Network connectivity issues (recoverable)
        if (message.includes('software caused connection abort') ||
            message.includes('connection reset') ||
            message.includes('network is unreachable') ||
            message.includes('connection timed out') ||
            message.includes('connection lost') ||
            message.includes('network error')) {
            return {
                category: 'NETWORK_ERROR',
                friendlyMessage: 'Network connection interrupted',
                shouldReconnect: true,
                isTemporary: true
            };
        }

        // DNS/Host resolution issues (recoverable)
        if (message.includes('host not found') ||
            message.includes('dns') ||
            message.includes('name resolution')) {
            return {
                category: 'DNS_ERROR',
                friendlyMessage: 'Unable to connect to chat server',
                shouldReconnect: true,
                isTemporary: true
            };
        }

        // Server-side issues (recoverable)
        if (message.includes('server') ||
            message.includes('503') ||
            message.includes('502') ||
            message.includes('504')) {
            return {
                category: 'SERVER_ERROR',
                friendlyMessage: 'Chat server temporarily unavailable',
                shouldReconnect: true,
                isTemporary: true
            };
        }

        // Authentication/Authorization issues (not recoverable)
        if (message.includes('unauthorized') ||
            message.includes('forbidden') ||
            message.includes('401') ||
            message.includes('403')) {
            return {
                category: 'AUTH_ERROR',
                friendlyMessage: 'Authentication required',
                shouldReconnect: false,
                isTemporary: false
            };
        }

        // Protocol/Format issues (not recoverable)
        if (message.includes('protocol') ||
            message.includes('handshake') ||
            message.includes('upgrade')) {
            return {
                category: 'PROTOCOL_ERROR',
                friendlyMessage: 'Connection protocol error',
                shouldReconnect: false,
                isTemporary: false
            };
        }

        // Default: treat as temporary network issue
        return {
            category: 'UNKNOWN_ERROR',
            friendlyMessage: 'Connection error occurred',
            shouldReconnect: true,
            isTemporary: true
        };
    }

    handleReconnection() {
        if (this.isIntentionalDisconnect || this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
            logger.warn('🚫 Reconnection aborted', {
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

        logger.info('🔄 Scheduling reconnection attempt', {
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
                    await this.connectUserToWebSocket(this.username);
                } catch (error) {
                    logger.error('❌ Reconnection attempt failed', {
                        attempt: this.reconnectAttempts,
                        error: error.message
                    });

                    // Schedule next attempt
                    this.handleReconnection();
                }
            }
        }, delay);
    }

    cancelReconnection() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.reconnectAttempts = 0;
    }

    // ===================================
    // MESSAGE PROCESSING
    // ===================================

    processIncomingMessage(data) {
        const type = data?.type || 'unknown';

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
            case 'message_sent':
                this.notifyListeners(this.eventListeners.message, data);
                break;

            // Success responses from Lambda functions
            case 'success':
                logger.info('✅ Backend operation successful', { operation: data.action });
                this.notifyListeners(this.eventListeners.message, data);
                break;

            // Presence / status
            case 'user_status':
                if (!this.eventListeners.userStatus) this.eventListeners.userStatus = new Set();
                this.notifyListeners(this.eventListeners.userStatus, data);
                break;

            // Handle mark as read confirmation from Lambda
            case 'messages_marked_read':
            case 'mark_as_read_success':
            case 'conversation_updated':
                this.notifyListeners(this.eventListeners.message, {
                    type: 'messages_marked_read',
                    ...data
                });
                break;

            // Handle errors
            case 'mark_as_read_error':
            case 'error':
                logger.error('❌ Backend error response', { message: data.message, code: data.statusCode });
                this.notifyListeners(this.eventListeners.message, data);
                break;

            // Fallback: Check if it's a real-time message without proper type
            default:
                // Check if this is a real-time message
                if (data.from && data.message && !data.type) {
                    const messageReceived = {
                        type: 'message_received',
                        from: data.from,
                        message: data.message,
                        timestamp: data.timestamp || new Date().toISOString(),
                        to: this.username
                    };
                    this.notifyListeners(this.eventListeners.message, messageReceived);
                }
                // Handle direct messages without type
                else if (data.from && data.message) {
                    this.notifyListeners(this.eventListeners.message, {
                        ...data,
                        type: 'message_received',
                        timestamp: data.timestamp || new Date().toISOString()
                    });
                }
                // Check if the message contains mark as read confirmation
                else if (data.message && typeof data.message === 'string' && data.message.includes('marked as read')) {
                    let otherUser = data.otherUserName || data.otherUser;

                    if (!otherUser && data.conversationId && data.conversationId.includes('#')) {
                        const parts = data.conversationId.split('#');
                        otherUser = parts.find(part => part !== this.username);
                    }

                    this.notifyListeners(this.eventListeners.message, {
                        type: 'messages_marked_read',
                        conversationId: data.conversationId,
                        otherUser: otherUser,
                        otherUserName: otherUser,
                        message: data.message
                    });
                }
                // Handle success responses that might be mark as read confirmations
                else if (data.statusCode === 200 && data.message && typeof data.message === 'string') {
                    if (data.message.includes('marked as read') || data.message.includes('read status updated')) {
                        this.notifyListeners(this.eventListeners.message, {
                            type: 'messages_marked_read',
                            message: data.message,
                            statusCode: data.statusCode
                        });
                    } else {
                        this.notifyListeners(this.eventListeners.message, data);
                    }
                }
                else {
                    this.notifyListeners(this.eventListeners.message, data);
                }
                break;
        }
    }

    /**
     * Send a message to another user
     */
    sendMessage(to, message) {
        if (!to || !message || typeof to !== 'string' || typeof message !== 'string') {
            logger.warn('⚠️ Invalid message parameters', { to, message });
            return false;
        }

        const cleanTo = to.trim();
        const cleanMessage = message.trim();

        if (!cleanTo || !cleanMessage) {
            logger.warn('⚠️ Empty message parameters after trimming');
            return false;
        }

        // Check connection
        if (!this.isConnected()) {
            logger.warn('⚠️ Cannot send message: not connected');
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
            logger.info('✅ Message sent successfully', {
                to: cleanTo,
                preview: cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '')
            });

            this.notifyListeners(this.eventListeners.message, {
                type: 'message_sent',
                to: cleanTo,
                message: cleanMessage,
                from: this.username,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.error('❌ Failed to send message', {
                to: cleanTo,
                preview: cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '')
            });
        }

        return success;
    }

    /**
     * Mark messages as read in a conversation
     */
    markMessagesAsRead(conversationWith) {
        if (!conversationWith || typeof conversationWith !== 'string') {
            logger.warn('⚠️ Invalid conversationWith parameter for markMessagesAsRead', { conversationWith });
            return false;
        }

        const cleanConversationWith = conversationWith.trim();

        if (!cleanConversationWith) {
            logger.warn('⚠️ Empty conversationWith parameter after trimming');
            return false;
        }

        // Check connection
        if (!this.isConnected()) {
            logger.warn('⚠️ Cannot mark messages as read: not connected');
            return false;
        }

        const conversationId = `${this.username}#${cleanConversationWith}`;

        // Create payload that matches your web version exactly
        const payload = {
            action: 'chat_readMsg',
            username: this.username,
            conversationId: conversationId,
            otherUserName: cleanConversationWith
        };

        // Send the action
        const success = this.sendAction('chat_readMsg', payload);

        // Log results
        if (success) {
            logger.info('✅ Mark as read request sent successfully', {
                action: 'chat_readMsg',
                username: this.username,
                conversationId: conversationId,
                otherUserName: cleanConversationWith
            });
        } else {
            logger.error('❌ Failed to send mark as read request', {
                username: this.username,
                otherUserName: cleanConversationWith
            });
        }

        return success;
    }

    /**
     * Send action to server with error handling
     */
    sendAction(action, payload = {}) {
        if (!this.isConnected()) {
            logger.warn('⚠️ Cannot send action: not connected', { action });
            return false;
        }

        const message = {
            action,
            ...payload
        };

        try {
            this.ws.send(JSON.stringify(message));
            this.metrics.messagesSent++;
            return true;
        } catch (error) {
            logger.error('❌ Failed to send action', {
                action,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Load chat list from backend
     */
    loadChatList(username) {
        if (!username || typeof username !== 'string') {
            logger.warn('⚠️ Invalid username for loadChatList', { username });
            return false;
        }

        if (!this.isConnected()) {
            logger.warn('⚠️ Cannot load chat list: not connected');
            return false;
        }

        const payload = {
            username: username.trim()
        };

        const success = this.sendAction('load_chatList', payload);

        if (success) {
            logger.info('📋 Chat list request sent', { username: username.trim() });
        } else {
            logger.error('❌ Failed to request chat list', { username: username.trim() });
        }

        return success;
    }

    /**
     * Load chat history between two users
     */
    loadChatHistory(user1, user2) {
        if (!user1 || !user2 || typeof user1 !== 'string' || typeof user2 !== 'string') {
            logger.warn('⚠️ Invalid parameters for loadChatHistory', { user1, user2 });
            return false;
        }

        if (!this.isConnected()) {
            logger.warn('⚠️ Cannot load chat history: not connected');
            return false;
        }

        const payload = {
            user1: user1.trim(),
            user2: user2.trim()
        };

        const success = this.sendAction('chat_history', payload);

        if (success) {
            logger.info('📚 Chat history request sent', { user1: user1.trim(), user2: user2.trim() });
        } else {
            logger.error('❌ Failed to request chat history', { user1: user1.trim(), user2: user2.trim() });
        }

        return success;
    }

    /**
     * Fetch user profile info including profile picture and instruments
     */
    async fetchUserProfile(username) {
        if (!username || typeof username !== 'string') {
            logger.warn('⚠️ Invalid username for profile fetch', { username });
            return null;
        }

        try {
            const url = `https://lynqhqnijd.execute-api.us-east-1.amazonaws.com/groovi/load_profile?field=username&value=${encodeURIComponent(username)}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000
            });

            if (!response.ok) {
                logger.warn('⚠️ Profile fetch failed', { username, status: response.status });
                return null;
            }

            const profileData = await response.json();
            logger.info('✅ Profile fetched successfully', { username });
            return profileData;

        } catch (error) {
            logger.error('❌ Failed to fetch user profile', {
                username,
                error: error.message
            });
            return null;
        }
    }

    // ===================================
    // STATE MANAGEMENT & UTILITIES
    // ===================================

    /**
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.connectionState === CONNECTION_STATES.CONNECTED &&
            this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get current connection state
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
    // EVENT HANDLERS
    // ===================================

    /**
     * Add listener for incoming messages
     */
    onMessage(callback) {
        if (typeof callback !== 'function') {
            logger.warn('⚠️ onMessage callback must be a function');
            return () => {};
        }

        this.eventListeners.message.add(callback);

        // Return unsubscribe function
        return () => {
            this.eventListeners.message.delete(callback);
        };
    }

    /**
     * Add listener for chat list updates
     */
    onChatListUpdate(callback) {
        if (typeof callback !== 'function') {
            logger.warn('⚠️ onChatListUpdate callback must be a function');
            return () => {};
        }

        this.eventListeners.chatList.add(callback);

        // Return unsubscribe function
        return () => {
            this.eventListeners.chatList.delete(callback);
        };
    }

    /**
     * Add listener for connection state changes
     */
    onConnectionChange(callback) {
        if (typeof callback !== 'function') {
            logger.warn('⚠️ onConnectionChange callback must be a function');
            return () => {};
        }

        this.eventListeners.connection.add(callback);

        // Return unsubscribe function
        return () => {
            this.eventListeners.connection.delete(callback);
        };
    }

    /**
     * Notify connection handlers
     */
    notifyConnectionHandlers(data) {
        this.eventListeners.connection.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                logger.error('❌ Error in connection callback', { error: error.message });
            }
        });
    }

    notifyListeners(set, payload) {
        set.forEach(cb => {
            try {
                cb(payload);
            } catch (e) {
                logger.error('❌ Listener error', { error: e.message });
            }
        });
    }

    /**
     * Notify error handlers
     */
    notifyErrorHandlers(error) {
        this.eventListeners.error.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                logger.error('❌ Error in error callback', { error: err.message });
            }
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.metrics.messagesReceived++;
            this.processIncomingMessage(data);
        } catch (error) {
            logger.error('❌ Failed to parse WebSocket message', {
                error: error.message,
                rawData: event.data
            });
        }
    }

    // ===================================
    // KEEP-ALIVE SYSTEM
    // ===================================

    startPingInterval() {
        this.stopPingInterval();

        this.pingInterval = setInterval(() => {
            if (this.connectionState === CONNECTION_STATES.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
                this.sendKeepAlivePing();
            }
        }, CONFIG.PING_INTERVAL);
    }

    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    sendKeepAlivePing() {
        if (!this.username) return;

        this.lastPingTime = Date.now();

        const pingPayload = {
            action: 'chat_keep_alive',
            username: this.username,
            timestamp: new Date().toISOString()
        };

        this.sendAction('chat_keep_alive', pingPayload);
    }
}

// Export singleton instance
export default new ChatService();


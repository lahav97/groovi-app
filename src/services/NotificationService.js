/**
 * @module NotificationService
 * Handles push notifications using Expo's push notification service
 * Integrates with ChatService for real-time message notifications
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/Logger';
import ChatService from './ChatService';
import NavigationService from './NavigationService';
import { Auth } from 'aws-amplify';

const logger = createLogger('NotificationService');

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

class NotificationService {
    constructor() {
        this.currentUsername = null;
        this.isInitialized = false;
        this.notificationListener = null;
        this.responseListener = null;
        this.messageUnsubscribe = null;
        this.expoPushToken = null;
    }

    /**
     * Initialize notification service
     * @param {string} username - Current user's username
     */
    async initialize(username) {
        if (this.isInitialized && this.currentUsername === username) {
            logger.info('✅ NotificationService already initialized for user');
            return;
        }

        try {
            this.currentUsername = username;

            // Register for push notifications
            await this.registerForPushNotifications();

            // Set up notification listeners
            this.setupNotificationListeners();

            // Set up chat message listeners
            this.setupChatMessageListeners();

            this.isInitialized = true;
            logger.info('✅ NotificationService initialized successfully', { username });

        } catch (error) {
            logger.error('❌ Failed to initialize NotificationService', { error: error.message });
            throw error;
        }
    }

    /**
     * Register for push notifications
     */
    async registerForPushNotifications() {
        if (!Device.isDevice) {
            logger.warn('⚠️ Must use physical device for Push Notifications');
            return null;
        }

        // Check existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permissions if not granted
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            logger.warn('⚠️ Push notification permissions not granted');
            return null;
        }

        // Get push token
        try {
            const token = (await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId,
            })).data;

            this.expoPushToken = token;
            logger.info('✅ Push notification token obtained', { token: token.substring(0, 20) + '...' });

            // Store token for later use
            await AsyncStorage.setItem('@push_token', token);

            // Register token with backend
            await this.registerTokenWithBackend();

            // Configure notification channel for Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('chat-messages', {
                    name: 'Chat Messages',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                    sound: 'default',
                });
            }

            return token;
        } catch (error) {
            logger.error('❌ Failed to get push token', { error: error.message });
            return null;
        }
    }

    /**
     * Register push token with backend
     */
    async registerTokenWithBackend() {
        logger.info('🔄 Starting push token registration with backend...', {
            hasToken: !!this.expoPushToken,
            hasUsername: !!this.currentUsername,
            username: this.currentUsername,
            tokenPreview: this.expoPushToken ? this.expoPushToken.substring(0, 30) + '...' : 'none'
        });

        if (!this.expoPushToken || !this.currentUsername) {
            logger.warn('⚠️ No push token or username available for backend registration');
            return false;
        }

        try {
            // Prepare the payload - no JWT token needed for push notification registration
            const payload = {
                username: this.currentUsername,
                deviceToken: this.expoPushToken,
                platform: Platform.OS
            };

            // Simple headers without authentication
            const headers = {
                'Content-Type': 'application/json',
            };

            // Log the request details
            logger.info('📤 Sending push token to backend (no auth required)', {
                url: 'https://oazj0arp73.execute-api.us-east-1.amazonaws.com/groovi/send_expo_token',
                method: 'POST',
                payload: {
                    username: payload.username,
                    deviceToken: payload.deviceToken.substring(0, 30) + '...', // Don't log full token
                    platform: payload.platform
                },
                headers: Object.keys(headers)
            });

            const response = await fetch('https://oazj0arp73.execute-api.us-east-1.amazonaws.com/groovi/send_expo_token', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            logger.info('📥 Backend response received', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (response.ok) {
                const result = await response.json();
                logger.info('✅ Push token registered with backend successfully!', {
                    username: this.currentUsername,
                    platform: Platform.OS,
                    response: result
                });
                return true;
            } else {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }

                logger.error('❌ Failed to register push token - HTTP error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData,
                    rawResponse: errorText
                });
                return false;
            }
        } catch (error) {
            logger.error('❌ Network error registering push token with backend', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Set up notification event listeners
     */
    setupNotificationListeners() {
        // Listener for notifications received while app is in foreground
        this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
            logger.info('📱 Notification received in foreground', {
                title: notification.request.content.title
            });
            this.handleForegroundNotification(notification);
        });

        // Listener for notification taps
        this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            logger.info('👆 Notification tapped', {
                actionIdentifier: response.actionIdentifier
            });
            this.handleNotificationResponse(response);
        });
    }

    /**
     * Set up chat message listeners for local notifications
     */
    setupChatMessageListeners() {
        if (this.messageUnsubscribe) {
            this.messageUnsubscribe();
        }

        this.messageUnsubscribe = ChatService.onMessage((data) => {
            // Only show notifications for received messages from other users
            if (data.type === 'message_received' && data.from !== this.currentUsername) {
                this.showChatNotification(data);
            }
            // Handle messages without proper type (real-time messages)
            else if (data.from && data.message && !data.type && data.from !== this.currentUsername) {
                this.showChatNotification({
                    type: 'message_received',
                    from: data.from,
                    message: data.message,
                    timestamp: data.timestamp
                });
            }
        });
    }

    /**
     * Handle notifications received in foreground
     */
    async handleForegroundNotification(notification) {
        const data = notification.request.content.data;

        if (data?.type === 'chat_message') {
            // Update badge count
            await this.updateBadgeCount();
        }
    }

    /**
     * Handle notification tap responses
     */
    handleNotificationResponse(response) {
        const data = response.notification.request.content.data;

        logger.info('👆 Processing notification response', {
            actionIdentifier: response.actionIdentifier,
            data: data
        });

        if (data?.type === 'chat_message' && data?.from) {
            // Use NavigationService to navigate to the specific chat
            try {
                logger.info('🚀 Navigating to chat from notification', {
                    userName: data.from,
                    conversationId: data.conversationId
                });

                // Navigate directly to the chat screen with the specific user
                NavigationService.navigateToChat(data.from, {
                    conversationId: data.conversationId,
                    fromNotification: true
                });

                // Clear this specific notification since user is viewing it
                this.clearNotificationForUser(data.from);

            } catch (error) {
                logger.error('❌ Failed to navigate to chat from notification', {
                    error: error.message,
                    userName: data.from
                });

                // Fallback: navigate to chat list
                NavigationService.navigateToChatList();
            }
        } else {
            logger.warn('⚠️ Unknown notification type or missing data', { data });
        }
    }

    /**
     * Show local notification for chat messages
     */
    async showChatNotification(messageData) {
        try {
            const { from, message, timestamp } = messageData;

            // Don't show notification if it's from current user
            if (from === this.currentUsername) {
                return;
            }

            // Create notification content
            const notificationContent = {
                title: from,
                body: message,
                data: {
                    type: 'chat_message',
                    from: from,
                    message: message,
                    timestamp: timestamp,
                    conversationId: `${this.currentUsername}#${from}`
                },
                badge: await this.getBadgeCount() + 1,
            };

            // Configure notification options
            const notificationOptions = {
                content: notificationContent,
                trigger: null, // Show immediately
            };

            // Add Android-specific options
            if (Platform.OS === 'android') {
                notificationOptions.content.channelId = 'chat-messages';
                notificationOptions.content.priority = Notifications.AndroidImportance.HIGH;
            }

            // Schedule notification
            await Notifications.scheduleNotificationAsync(notificationOptions);

            logger.info('✅ Chat notification scheduled', { from, preview: message.substring(0, 30) });

        } catch (error) {
            logger.error('❌ Failed to show chat notification', { error: error.message });
        }
    }

    /**
     * Update app badge count
     */
    async updateBadgeCount() {
        try {
            const unreadCount = await this.getUnreadMessageCount();
            await Notifications.setBadgeCountAsync(unreadCount);
            logger.info('📱 Badge count updated', { count: unreadCount });
        } catch (error) {
            logger.error('❌ Failed to update badge count', { error: error.message });
        }
    }

    /**
     * Get current badge count
     */
    async getBadgeCount() {
        try {
            return await Notifications.getBadgeCountAsync() || 0;
        } catch (error) {
            logger.error('❌ Failed to get badge count', { error: error.message });
            return 0;
        }
    }

    /**
     * Get unread message count from storage
     */
    async getUnreadMessageCount() {
        try {
            const unreadCount = await AsyncStorage.getItem('@unread_count');
            return parseInt(unreadCount || '0', 10);
        } catch (error) {
            logger.error('❌ Failed to get unread count', { error: error.message });
            return 0;
        }
    }

    /**
     * Set unread message count
     */
    async setUnreadMessageCount(count) {
        try {
            await AsyncStorage.setItem('@unread_count', count.toString());
            await this.updateBadgeCount();
        } catch (error) {
            logger.error('❌ Failed to set unread count', { error: error.message });
        }
    }

    /**
     * Clear all notifications
     */
    async clearAllNotifications() {
        try {
            await Notifications.dismissAllNotificationsAsync();
            await Notifications.setBadgeCountAsync(0);
            await AsyncStorage.setItem('@unread_count', '0');
            logger.info('✅ All notifications cleared');
        } catch (error) {
            logger.error('❌ Failed to clear notifications', { error: error.message });
        }
    }

    /**
     * Clear notifications for a specific user
     * @param {string} userName - Username to clear notifications for
     */
    async clearNotificationForUser(userName) {
        try {
            // Get all delivered notifications
            const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();

            // Find notifications from the specific user
            const userNotifications = deliveredNotifications.filter(notification =>
                notification.request.content.data?.from === userName &&
                notification.request.content.data?.type === 'chat_message'
            );

            // Dismiss notifications from this user
            for (const notification of userNotifications) {
                await Notifications.dismissNotificationAsync(notification.request.identifier);
            }

            if (userNotifications.length > 0) {
                logger.info('✅ Cleared notifications for user', {
                    userName,
                    count: userNotifications.length
                });

                // Update badge count after clearing notifications
                await this.updateBadgeCount();
            }
        } catch (error) {
            logger.error('❌ Failed to clear notifications for user', {
                userName,
                error: error.message
            });
        }
    }

    /**
     * Handle app state changes for notification navigation
     * This ensures notifications work properly when app is opened from background
     */
    async handleAppStateChange(nextAppState) {
        if (nextAppState === 'active') {
            // Check if there are any notifications that were tapped while app was in background
            try {
                const lastNotificationResponse = await Notifications.getLastNotificationResponseAsync();

                if (lastNotificationResponse &&
                    lastNotificationResponse.notification.request.content.data?.type === 'chat_message') {

                    const data = lastNotificationResponse.notification.request.content.data;
                    logger.info('📱 Processing notification from app background', { from: data.from });

                    // Small delay to ensure navigation is ready
                    setTimeout(() => {
                        this.handleNotificationResponse(lastNotificationResponse);
                    }, 500);
                }
            } catch (error) {
                logger.error('❌ Failed to handle app state change notification', {
                    error: error.message
                });
            }
        }
    }

    /**
     * Clean up notification service
     */
    cleanup() {
        if (this.notificationListener) {
            Notifications.removeNotificationSubscription(this.notificationListener);
            this.notificationListener = null;
        }

        if (this.responseListener) {
            Notifications.removeNotificationSubscription(this.responseListener);
            this.responseListener = null;
        }

        if (this.messageUnsubscribe) {
            this.messageUnsubscribe();
            this.messageUnsubscribe = null;
        }

        this.isInitialized = false;
        this.currentUsername = null;

        logger.info('✅ NotificationService cleaned up');
    }

    /**
     * Get push token for backend registration
     */
    async getPushToken() {
        try {
            return this.expoPushToken || await AsyncStorage.getItem('@push_token');
        } catch (error) {
            logger.error('❌ Failed to get push token', { error: error.message });
            return null;
        }
    }
}

// Export singleton instance
export default new NotificationService();

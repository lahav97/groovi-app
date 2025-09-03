/**
 * @module NavigationService
 * Handles programmatic navigation throughout the app
 * Used for deep linking and notification handling
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import { createLogger } from '../utils/Logger';

const logger = createLogger('NavigationService');

// Create navigation ref that can be used outside of React components
export const navigationRef = createNavigationContainerRef();

class NavigationService {
    constructor() {
        this.isReady = false;
        this.pendingNavigations = [];
    }

    /**
     * Set navigation as ready and process any pending navigations
     */
    setReady() {
        this.isReady = true;
        logger.info('✅ Navigation service is ready');

        // Process any pending navigations
        while (this.pendingNavigations.length > 0) {
            const { routeName, params } = this.pendingNavigations.shift();
            this.navigate(routeName, params);
        }
    }

    /**
     * Check if navigation is ready
     */
    isNavigationReady() {
        return this.isReady && navigationRef.isReady();
    }

    /**
     * Navigate to a specific route
     * @param {string} routeName - The name of the route to navigate to
     * @param {object} params - Parameters to pass to the route
     */
    navigate(routeName, params = {}) {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, queuing navigation', { routeName, params });
            this.pendingNavigations.push({ routeName, params });
            return;
        }

        try {
            navigationRef.navigate(routeName, params);
            logger.info('✅ Navigated successfully', { routeName, params });
        } catch (error) {
            logger.error('❌ Navigation failed', {
                routeName,
                params,
                error: error.message
            });
        }
    }

    /**
     * Navigate to chat screen with specific user
     * @param {string} userName - Username to chat with
     * @param {object} additionalParams - Additional parameters
     */
    navigateToChat(userName, additionalParams = {}) {
        if (!userName) {
            logger.error('❌ Cannot navigate to chat: no userName provided');
            return;
        }

        const params = {
            userName,
            ...additionalParams
        };

        logger.info('🚀 Navigating to chat', params);
        this.navigate('ChatScreen', params);
    }

    /**
     * Navigate to chat list
     */
    navigateToChatList() {
        logger.info('🚀 Navigating to chat list');
        this.navigate('MainTabs', { screen: 'ChatList' });
    }

    /**
     * Navigate to main tabs with specific tab
     * @param {string} tabName - Tab to navigate to
     */
    navigateToMainTab(tabName) {
        logger.info('🚀 Navigating to main tab', { tabName });
        this.navigate('MainTabs', { screen: tabName });
    }

    /**
     * Go back to previous screen
     */
    goBack() {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, cannot go back');
            return;
        }

        try {
            if (navigationRef.canGoBack()) {
                navigationRef.goBack();
                logger.info('✅ Navigated back');
            } else {
                logger.warn('⚠️ Cannot go back, no previous screen');
            }
        } catch (error) {
            logger.error('❌ Failed to go back', { error: error.message });
        }
    }

    /**
     * Reset navigation stack to specific route
     * @param {string} routeName - Route to reset to
     * @param {object} params - Parameters for the route
     */
    reset(routeName, params = {}) {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, queuing reset', { routeName, params });
            this.pendingNavigations.push({ routeName, params, isReset: true });
            return;
        }

        try {
            navigationRef.reset({
                index: 0,
                routes: [{ name: routeName, params }],
            });
            logger.info('✅ Navigation reset', { routeName, params });
        } catch (error) {
            logger.error('❌ Navigation reset failed', {
                routeName,
                params,
                error: error.message
            });
        }
    }

    /**
     * Get current route name
     */
    getCurrentRouteName() {
        if (!this.isNavigationReady()) {
            return null;
        }

        try {
            return navigationRef.getCurrentRoute()?.name;
        } catch (error) {
            logger.error('❌ Failed to get current route name', { error: error.message });
            return null;
        }
    }

    /**
     * Check if currently on a specific route
     * @param {string} routeName - Route name to check
     */
    isCurrentRoute(routeName) {
        const currentRoute = this.getCurrentRouteName();
        return currentRoute === routeName;
    }
}

// Export singleton instance
export default new NavigationService();

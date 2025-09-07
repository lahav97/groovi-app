import { createNavigationContainerRef } from '@react-navigation/native';
import { createLogger } from '../utils/Logger';
import AppMemoryManager from '../utils/AppMemoryManager';

const logger = createLogger('NavigationService');

// Create navigation ref that can be used outside of React components
export const navigationRef = createNavigationContainerRef();

class NavigationService {
    constructor() {
        this.isReady = false;
        this.pendingNavigations = [];
        this.currentRouteName = null;
        this.navigationListeners = new Set();
    }

    /**
     * Set navigation as ready and process any pending navigations
     */
    setReady() {
        this.isReady = true;
        logger.info('✅ Navigation service is ready');

        // Set up navigation state change listener for cleanup coordination
        this.setupNavigationStateListener();

        // Process any pending navigations
        while (this.pendingNavigations.length > 0) {
            const navigation = this.pendingNavigations.shift();
            if (navigation.isReset) {
                this.reset(navigation.routeName, navigation.params);
            } else {
                this.navigate(navigation.routeName, navigation.params);
            }
        }
    }

    /**
     * Setup navigation state change listener for cleanup coordination
     */
    setupNavigationStateListener() {
        if (!navigationRef.isReady()) return;

        // Listen for navigation state changes
        const unsubscribe = navigationRef.addListener('state', (e) => {
            const currentRoute = navigationRef.getCurrentRoute();
            const newRouteName = currentRoute?.name;

            if (newRouteName && newRouteName !== this.currentRouteName) {
                const previousRoute = this.currentRouteName;
                this.currentRouteName = newRouteName;

                logger.debug('🧭 Navigation state changed', {
                    from: previousRoute,
                    to: newRouteName
                });

                // Notify AppMemoryManager of navigation change for cleanup coordination
                AppMemoryManager.onNavigationChange?.(previousRoute, newRouteName);

                // Notify any additional listeners
                this.notifyNavigationListeners(previousRoute, newRouteName);
            }
        });

        // Store current route name on initialization
        if (navigationRef.isReady()) {
            const currentRoute = navigationRef.getCurrentRoute();
            this.currentRouteName = currentRoute?.name;
            logger.debug('🧭 Initial route name set', { routeName: this.currentRouteName });
        }

        return unsubscribe;
    }

    /**
     * Add navigation change listener
     */
    addNavigationListener(listener) {
        this.navigationListeners.add(listener);
        logger.debug('📝 Navigation listener added', {
            totalListeners: this.navigationListeners.size
        });
    }

    /**
     * Remove navigation change listener
     */
    removeNavigationListener(listener) {
        this.navigationListeners.delete(listener);
        logger.debug('📝 Navigation listener removed', {
            totalListeners: this.navigationListeners.size
        });
    }

    /**
     * Notify all navigation listeners
     */
    notifyNavigationListeners(from, to) {
        if (this.navigationListeners.size === 0) return;

        logger.debug('📢 Notifying navigation listeners', {
            listenerCount: this.navigationListeners.size,
            from,
            to
        });

        let notifiedCount = 0;
        let errorCount = 0;

        this.navigationListeners.forEach(listener => {
            try {
                listener(from, to);
                notifiedCount++;
            } catch (error) {
                errorCount++;
                logger.warn('⚠️ Navigation listener error', {
                    error: error.message,
                    from,
                    to
                });
            }
        });

        logger.debug('📢 Navigation listener notifications completed', {
            notifiedCount,
            errorCount
        });
    }

    /**
     * Check if navigation is ready
     */
    isNavigationReady() {
        return this.isReady && navigationRef.isReady();
    }

    /**
     * Navigate to a specific route with cleanup coordination
     */
    navigate(routeName, params = {}) {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, queuing navigation', { routeName, params });
            this.pendingNavigations.push({ routeName, params });
            return;
        }

        try {
            const previousRoute = this.getCurrentRouteName();

            // Request routine cleanup before navigation (non-blocking)
            if (previousRoute && previousRoute !== routeName) {
                AppMemoryManager.requestRoutineCleanup?.(`navigation_${previousRoute}_to_${routeName}`);
            }

            navigationRef.navigate(routeName, params);
            logger.info('✅ Navigated successfully', {
                from: previousRoute,
                to: routeName,
                params
            });
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
     */
    navigateToMainTab(tabName) {
        logger.info('🚀 Navigating to main tab', { tabName });
        this.navigate('MainTabs', { screen: tabName });
    }

    /**
     * Go back to previous screen with cleanup coordination
     */
    goBack() {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, cannot go back');
            return;
        }

        try {
            if (navigationRef.canGoBack()) {
                const currentRoute = this.getCurrentRouteName();

                // Request routine cleanup before going back
                AppMemoryManager.requestRoutineCleanup?.(`back_from_${currentRoute}`);

                navigationRef.goBack();
                logger.info('✅ Navigated back', { from: currentRoute });
            } else {
                logger.warn('⚠️ Cannot go back, no previous screen');
            }
        } catch (error) {
            logger.error('❌ Failed to go back', { error: error.message });
        }
    }

    /**
     * Reset navigation stack to specific route with cleanup coordination
     */
    reset(routeName, params = {}) {
        if (!this.isNavigationReady()) {
            logger.warn('⚠️ Navigation not ready, queuing reset', { routeName, params });
            this.pendingNavigations.push({ routeName, params, isReset: true });
            return;
        }

        try {
            const previousRoute = this.getCurrentRouteName();

            // Request emergency cleanup before navigation reset
            AppMemoryManager.forceCleanup?.(`navigation_reset_${previousRoute}_to_${routeName}`);

            navigationRef.reset({
                index: 0,
                routes: [{ name: routeName, params }],
            });
            logger.info('✅ Navigation reset', {
                from: previousRoute,
                to: routeName,
                params
            });
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
            return this.currentRouteName; // Return cached value if not ready
        }

        try {
            const currentRoute = navigationRef.getCurrentRoute();
            const routeName = currentRoute?.name;
            if (routeName) {
                this.currentRouteName = routeName; // Update cache
            }
            return routeName;
        } catch (error) {
            logger.error('❌ Failed to get current route name', { error: error.message });
            return this.currentRouteName; // Return cached value on error
        }
    }

    /**
     * Check if currently on a specific route
     */
    isCurrentRoute(routeName) {
        const currentRoute = this.getCurrentRouteName();
        return currentRoute === routeName;
    }

    /**
     * Get navigation statistics for debugging
     */
    getNavigationStats() {
        return {
            isReady: this.isReady,
            currentRoute: this.currentRouteName,
            pendingNavigations: this.pendingNavigations.length,
            navigationListeners: this.navigationListeners.size,
            canGoBack: this.isNavigationReady() ? navigationRef.canGoBack() : false
        };
    }

    /**
     * Cleanup method for shutdown
     */
    shutdown() {
        logger.warn('🚫 Shutting down NavigationService');

        // Clear listeners and pending navigations
        this.navigationListeners.clear();
        this.pendingNavigations = [];
        this.isReady = false;
        this.currentRouteName = null;

        logger.info('✅ NavigationService shutdown completed');
    }
}

// Export singleton instance
export default new NavigationService();
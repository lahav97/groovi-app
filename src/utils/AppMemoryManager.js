import { AppState } from 'react-native';
import { clearAllCaches, manageCacheSize } from './cacheManager';
import BackgroundDataService from '../services/BackgroundDataService';
import { createLogger } from './Logger';

const logger = createLogger('AppMemoryManager');

class AppMemoryManager {
    constructor() {
        this.appStateSubscription = null;
        this.cleanupInterval = null;
        this.lastCleanup = 0;
        this.isInitialized = false;
        this.navigationListeners = new Set();
        this.lastNavigationCleanup = 0;
        this.memoryPressureLevel = 'normal';
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Monitor app state changes
        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background') {
                this.performBackgroundCleanup();
            } else if (nextAppState === 'active') {
                this.performActiveCleanup();
            }
        });

        // Cleanup every 30 seconds
        this.cleanupInterval = setInterval(() => {
            this.performPeriodicCleanup();
        }, 30 * 1000);

        this.startMemoryMonitoring();
    }

    /**
     * Add navigation listener for immediate video cleanup
     */
    addNavigationListener(listener) {
        this.navigationListeners.add(listener);
    }

    removeNavigationListener(listener) {
        this.navigationListeners.delete(listener);
    }

    /**
     * CRITICAL: Called immediately when navigation occurs
     */
    async onNavigationChange(from, to) {
        const now = Date.now();
        
        // Prevent too frequent cleanup calls
        if (now - this.lastNavigationCleanup < 500) return;
        this.lastNavigationCleanup = now;

        try {
            // 1. Immediately notify all listeners to clean up videos
            this.navigationListeners.forEach(listener => {
                try {
                    listener('navigation_cleanup');
                } catch (error) {
                    logger.warn('Navigation listener error', { error: error.message });
                }
            });

            // 2. Cancel all background requests
            BackgroundDataService.cancelAllRequests();

            // 3. Force garbage collection if available
            if (global.gc) {
                setTimeout(() => {
                    global.gc();
                }, 200);
            }

            // 4. Clean cache if memory pressure is high
            if (this.memoryPressureLevel !== 'normal') {
                await this.performEmergencyCleanup('navigation_pressure');
            }

        } catch (error) {
            logger.error('Navigation cleanup error', { error: error.message });
        }
    }

    /**
     * EMERGENCY CLEANUP - For critical memory situations
     */
    async performEmergencyCleanup(reason = 'unknown') {
        logger.warn(`Emergency cleanup triggered: ${reason}`);

        try {
            // 1. Clear all video caches immediately
            await clearAllCaches();

            // 2. Notify all listeners for emergency cleanup
            this.navigationListeners.forEach(listener => {
                try {
                    listener('emergency_cleanup');
                } catch (error) {
                    logger.warn('Emergency listener error', { error: error.message });
                }
            });

            // 3. Cancel all requests
            BackgroundDataService.cancelAllRequests();

            // 4. Aggressive cache size reduction
            await manageCacheSize(10); // Reduce to 10MB

            // 5. Force garbage collection multiple times
            if (global.gc) {
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => global.gc(), i * 100);
                }
            }

            logger.info(`Emergency cleanup completed: ${reason}`);

        } catch (error) {
            logger.error('Emergency cleanup failed', { error: error.message, reason });
        }
    }

    async performBackgroundCleanup() {
        try {
            await this.performEmergencyCleanup('app_background');
            await manageCacheSize(25);
            BackgroundDataService.cancelAllRequests();
        } catch (error) {
            logger.error('🚨 Background cleanup error', { error: error.message });
        }
    }

    async performActiveCleanup() {
        const now = Date.now();

        if (now - this.lastCleanup > 30 * 1000) {
            this.lastCleanup = now;

            try {
                const maxCacheSize = this.memoryPressureLevel === 'critical' ? 30 :
                                   this.memoryPressureLevel === 'warning' ? 50 : 75;
                
                await manageCacheSize(maxCacheSize);

                const systemStatus = BackgroundDataService.getSeparatedSystemStatus();
                if (systemStatus.feed.hasError || systemStatus.profile.hasError) {
                    logger.warn('⚠️ System issues detected', {
                        feedError: systemStatus.feed.error,
                        profileError: systemStatus.profile.error
                    });
                }

            } catch (error) {
                logger.error('🚨 Active cleanup error', { error: error.message });
            }
        }
    }

    async performPeriodicCleanup() {
        try {
            const systemStatus = BackgroundDataService.getSeparatedSystemStatus();
            if (systemStatus.feed.hasError || systemStatus.profile.hasError) {
                logger.warn('⚠️ System issues detected', {
                    feedError: systemStatus.feed.error,
                    profileError: systemStatus.profile.error
                });
            }

            const maxCacheSize = this.memoryPressureLevel === 'critical' ? 25 :
                               this.memoryPressureLevel === 'warning' ? 40 : 60;
            
            await manageCacheSize(maxCacheSize);

            this.navigationListeners.forEach(listener => {
                try {
                    listener('periodic_cleanup');
                } catch (error) {
                    logger.warn('⚠️ Periodic listener error', { error: error.message });
                }
            });

            if (this.memoryPressureLevel !== 'normal' && global.gc) {
                global.gc();
            }

        } catch (error) {
            logger.error('🚨 Periodic cleanup error', { error: error.message });
        }
    }

    /**
     * Start monitoring memory pressure levels
     */
    startMemoryMonitoring() {
        // Monitor memory pressure if available
        if (global.performance?.memory) {
            // Check memory every 15 seconds
            setInterval(() => {
                if (!this.isInitialized) return;

                try {
                    const heap = global.performance.memory;
                    const usedMB = heap.usedJSHeapSize / 1024 / 1024;
                    const limitMB = heap.jsHeapSizeLimit / 1024 / 1024;
                    const usagePercent = (usedMB / limitMB) * 100;

                    // Update memory pressure level
                    const oldLevel = this.memoryPressureLevel;

                    if (usagePercent > 85) {
                        this.memoryPressureLevel = 'critical';
                    } else if (usagePercent > 70) {
                        this.memoryPressureLevel = 'warning';
                    } else {
                        this.memoryPressureLevel = 'normal';
                    }

                    // Trigger emergency cleanup if memory pressure is critical
                    if (this.memoryPressureLevel === 'critical' && oldLevel !== 'critical') {
                        logger.warn(`🚨 Critical memory pressure detected: ${usagePercent.toFixed(1)}%`);
                        this.performEmergencyCleanup('critical_memory_pressure').catch(error => {
                            logger.error('Emergency cleanup failed', { error: error.message });
                        });
                    }

                } catch (error) {
                    logger.warn('Memory monitoring error', { error: error.message });
                }
            }, 15000); // Check every 15 seconds
        }

        // React Native memory warning listener
        if (typeof global.addEventListener === 'function') {
            try {
                global.addEventListener('memoryWarning', () => {
                    logger.warn('🚨 System memory warning received');
                    this.memoryPressureLevel = 'critical';
                    this.performEmergencyCleanup('system_memory_warning').catch(error => {
                        logger.error('Emergency cleanup failed', { error: error.message });
                    });
                });
            } catch (error) {
                logger.debug('Memory warning listener not available');
            }
        }
    }

    // Enhanced cache stats
    getSimpleCacheStats() {
        const loadingStatus = BackgroundDataService.getLoadingStatus();

        // Add memory info if available
        let memoryInfo = {};
        if (global.performance?.memory) {
            const heap = global.performance.memory;
            memoryInfo = {
                usedJSHeapMB: Math.round(heap.usedJSHeapSize / 1024 / 1024),
                totalJSHeapMB: Math.round(heap.totalJSHeapSize / 1024 / 1024),
                heapLimitMB: Math.round(heap.jsHeapSizeLimit / 1024 / 1024),
            };
        }

        return {
            backgroundService: {
                isLoading: loadingStatus.isLoading,
                currentStage: loadingStatus.currentStage,
                feedLoaded: loadingStatus.systems.feed.loaded,
                profileLoaded: loadingStatus.systems.profile.loaded,
                feedError: loadingStatus.systems.feed.hasError,
                profileError: loadingStatus.systems.profile.hasError,
                totalFeedVideos: loadingStatus.totalFeedVideos,
                totalProfileVideos: loadingStatus.totalProfileVideos
            },
            memory: memoryInfo,
            memoryPressure: this.memoryPressureLevel,
            navigationListeners: this.navigationListeners.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * PUBLIC: Get current memory status
     */
    getMemoryStatus() {
        return {
            pressure: this.memoryPressureLevel,
            listenerCount: this.navigationListeners.size,
            lastCleanup: this.lastCleanup,
            lastNavigationCleanup: this.lastNavigationCleanup
        };
    }

    /**
     * PUBLIC: Force immediate cleanup
     */
    async forceCleanup(reason = 'manual') {
        logger.info(`Force cleanup triggered: ${reason}`);
        await this.performEmergencyCleanup(reason);
    }

    /**
     * PUBLIC: Clear all memory and caches - used by AppNavigator
     */
    async clearAll(reason = 'navigation') {
        logger.info(`AppMemoryManager.clearAll triggered: ${reason}`);

        try {
            // 1. Cancel all background requests first
            BackgroundDataService.cancelAllRequests?.();
            
            // 2. Trigger video cleanup through all listeners
            this.navigationListeners.forEach(listener => {
                try {
                    listener('clear_all');
                } catch (error) {
                    logger.warn('Listener error during clearAll', { error: error.message });
                }
            });
            
            // 3. Clear all caches
            await clearAllCaches();
            
            // 4. Force garbage collection multiple times
            if (global.gc) {
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        global.gc();
                        if (i === 2) logger.debug('AppMemoryManager.clearAll - GC completed');
                    }, i * 100);
                }
            }
            
        } catch (error) {
            logger.error('AppMemoryManager.clearAll failed', { error: error.message });
        }
    }

    shutdown() {
        logger.warn('Shutting down AppMemoryManager');

        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Cancel requests
        BackgroundDataService.cancelAllRequests();
        
        // Clear all listeners
        this.navigationListeners.clear();
        
        this.isInitialized = false;

        logger.info('AppMemoryManager shutdown complete');
    }
}

export default new AppMemoryManager();
import { AppState } from 'react-native';
import { clearAllCaches, manageCacheSize } from './cacheManager';
import BackgroundDataService from '../services/BackgroundDataService';

class AppMemoryManager {
    constructor() {
        this.appStateSubscription = null;
        this.cleanupInterval = null;
        this.lastCleanup = 0;
        this.isInitialized = false;
        this.navigationListeners = new Set();
        this.lastNavigationCleanup = 0;
        this.memoryPressureLevel = 'normal'; // normal, warning, critical
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log('🚀 AppMemoryManager initialized with video memory management');

        // Monitor app state changes
        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background') {
                this.performBackgroundCleanup();
            } else if (nextAppState === 'active') {
                this.performActiveCleanup();
            }
        });

        // AGGRESSIVE cleanup every 30 seconds (reduced from 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.performPeriodicCleanup();
        }, 30 * 1000);

        // Memory pressure monitoring
        this.startMemoryMonitoring();
    }

    /**
     * CRITICAL: Add navigation listener for immediate video cleanup
     */
    addNavigationListener(listener) {
        this.navigationListeners.add(listener);
        console.log(`📱 Added navigation listener (total: ${this.navigationListeners.size})`);
    }

    removeNavigationListener(listener) {
        this.navigationListeners.delete(listener);
        console.log(`📱 Removed navigation listener (total: ${this.navigationListeners.size})`);
    }

    /**
     * CRITICAL: Called immediately when navigation occurs
     */
    async onNavigationChange(from, to) {
        const now = Date.now();
        
        // Prevent too frequent cleanup calls
        if (now - this.lastNavigationCleanup < 500) return;
        this.lastNavigationCleanup = now;

        console.log(`🔄 Navigation: ${from} → ${to} - triggering video cleanup`);

        try {
            // 1. Immediately notify all listeners to clean up videos
            this.navigationListeners.forEach(listener => {
                try {
                    listener('navigation_cleanup');
                } catch (error) {
                    console.warn('Navigation listener error:', error);
                }
            });

            // 2. Cancel all background requests
            BackgroundDataService.cancelAllRequests();

            // 3. Force garbage collection if available
            if (global.gc) {
                setTimeout(() => {
                    global.gc();
                    console.log('♻️ Forced GC after navigation');
                }, 200);
            }

            // 4. Clean cache if memory pressure is high
            if (this.memoryPressureLevel !== 'normal') {
                await this.performEmergencyCleanup('navigation_pressure');
            }

        } catch (error) {
            console.error('❌ Navigation cleanup error:', error);
        }
    }

    /**
     * ENHANCED: Memory pressure monitoring
     */
    startMemoryMonitoring() {
        setInterval(() => {
            try {
                // Check JS heap if available
                const jsHeap = global.performance?.memory?.usedJSHeapSize;
                const totalHeap = global.performance?.memory?.totalJSHeapSize;

                if (jsHeap && totalHeap) {
                    const heapMB = jsHeap / 1024 / 1024;
                    const usage = jsHeap / totalHeap;

                    // Update memory pressure level
                    const oldLevel = this.memoryPressureLevel;
                    
                    if (heapMB > 1500 || usage > 0.9) {
                        this.memoryPressureLevel = 'critical';
                    } else if (heapMB > 800 || usage > 0.7) {
                        this.memoryPressureLevel = 'warning';
                    } else {
                        this.memoryPressureLevel = 'normal';
                    }

                    // Trigger emergency cleanup if pressure increased
                    if (this.memoryPressureLevel === 'critical' && oldLevel !== 'critical') {
                        console.log(`🚨 CRITICAL memory pressure detected: ${heapMB.toFixed(0)}MB`);
                        this.performEmergencyCleanup('memory_pressure');
                    }

                    console.log(`📊 Memory: ${heapMB.toFixed(0)}MB (${(usage * 100).toFixed(1)}%) - ${this.memoryPressureLevel}`);
                }
            } catch (error) {
                console.warn('Memory monitoring error:', error);
            }
        }, 10000); // Check every 10 seconds
    }

    /**
     * EMERGENCY CLEANUP - For critical memory situations
     */
    async performEmergencyCleanup(reason = 'unknown') {
        console.log(`🚨 EMERGENCY CLEANUP - ${reason}`);

        try {
            // 1. Clear all video caches immediately
            await clearAllCaches();

            // 2. Notify all listeners for emergency cleanup
            this.navigationListeners.forEach(listener => {
                try {
                    listener('emergency_cleanup');
                } catch (error) {
                    console.warn('Emergency listener error:', error);
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

            console.log('✅ Emergency cleanup completed');

        } catch (error) {
            console.error('❌ Emergency cleanup failed:', error);
        }
    }

    async performBackgroundCleanup() {
        console.log('🧹 App backgrounded - aggressive video cleanup');

        try {
            // AGGRESSIVE cleanup when backgrounded
            await this.performEmergencyCleanup('app_background');

            // Reduce cache size to minimum
            await manageCacheSize(25); // 25MB limit when backgrounded

            // Cancel all requests
            BackgroundDataService.cancelAllRequests();

            // Get simple cache stats
            const stats = this.getSimpleCacheStats();
            console.log('📊 Background cache stats:', stats);

        } catch (error) {
            console.error('❌ Background cleanup error:', error);
        }
    }

    async performActiveCleanup() {
        const now = Date.now();

        // More frequent cleanup (reduced from 2 minutes to 30 seconds)
        if (now - this.lastCleanup > 30 * 1000) {
            this.lastCleanup = now;

            try {
                // Manage cache size based on memory pressure
                const maxCacheSize = this.memoryPressureLevel === 'critical' ? 30 : 
                                   this.memoryPressureLevel === 'warning' ? 50 : 75;
                
                await manageCacheSize(maxCacheSize);

                // Check system status
                const systemStatus = BackgroundDataService.getSeparatedSystemStatus();
                if (systemStatus.feed.hasError || systemStatus.profile.hasError) {
                    console.warn('⚠️ System issues detected:', {
                        feedError: systemStatus.feed.error,
                        profileError: systemStatus.profile.error
                    });
                }

                console.log(`✅ Active cleanup completed (cache limit: ${maxCacheSize}MB)`);

            } catch (error) {
                console.error('❌ Active cleanup error:', error);
            }
        }
    }

    async performPeriodicCleanup() {
        console.log('🧹 Periodic cleanup (aggressive)');

        try {
            // Check system status
            const systemStatus = BackgroundDataService.getSeparatedSystemStatus();
            if (systemStatus.feed.hasError || systemStatus.profile.hasError) {
                console.warn('⚠️ System issues detected:', {
                    feedError: systemStatus.feed.error,
                    profileError: systemStatus.profile.error
                });
            }

            // Adaptive cache management based on memory pressure
            const maxCacheSize = this.memoryPressureLevel === 'critical' ? 25 : 
                               this.memoryPressureLevel === 'warning' ? 40 : 60;
            
            await manageCacheSize(maxCacheSize);

            // Notify listeners for periodic cleanup
            this.navigationListeners.forEach(listener => {
                try {
                    listener('periodic_cleanup');
                } catch (error) {
                    console.warn('Periodic listener error:', error);
                }
            });

            // Force GC if memory pressure is high
            if (this.memoryPressureLevel !== 'normal' && global.gc) {
                global.gc();
                console.log('♻️ Periodic GC due to memory pressure');
            }

            // Get stats
            const stats = this.getSimpleCacheStats();
            console.log('📊 Periodic cache stats:', stats);

        } catch (error) {
            console.error('❌ Periodic cleanup error:', error);
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
        console.log(`🔧 Force cleanup triggered: ${reason}`);
        await this.performEmergencyCleanup(reason);
    }

    shutdown() {
        console.log('💥 Shutting down AppMemoryManager');

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

        console.log('✅ AppMemoryManager shutdown complete');
    }
}

export default new AppMemoryManager();
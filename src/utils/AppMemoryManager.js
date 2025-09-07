import { AppState } from 'react-native';
import { performRoutineCleanup, clearAllCaches, manageCacheSize } from './cacheManager';
import BackgroundDataService from '../services/BackgroundDataService';
import { createLogger } from './Logger';

const logger = createLogger('AppMemoryManager');

// Cleanup reason levels for single-gate routing
const CLEANUP_REASONS = {
    ROUTINE: 'routine',
    EMERGENCY: 'emergency'
};

// Cleanup triggers
const CLEANUP_TRIGGERS = {
    NAVIGATION: 'navigation',
    UNFOCUS: 'unfocus',
    PERIODIC: 'periodic',
    MEMORY_PRESSURE: 'memory_pressure',
    MANUAL: 'manual',
    APP_BACKGROUND: 'app_background'
};

class AppMemoryManager {
    constructor() {
        this.appStateSubscription = null;
        this.cleanupInterval = null;
        this.lastCleanup = 0;
        this.isInitialized = false;
        this.navigationListeners = new Set();
        this.lastNavigationCleanup = 0;
        this.memoryPressureLevel = 'normal';

        // Single cleanup gate state
        this.cleanupInProgress = false;
        this.pendingCleanupReasons = new Set();
        this.cleanupDebounceTimer = null;
        this.cleanupDebounceDelay = 400; // 400ms window for coalescing
        this.cleanupBatchId = 0;

        // Storm protection state
        this.emergencyRequestTimes = [];
        this.stormProtectionWindow = 60000; // 60 seconds
        this.maxEmergencyRequests = 2;
        this.stormProtectionActive = false;
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Monitor app state changes
        this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background') {
                this.requestCleanup(CLEANUP_TRIGGERS.APP_BACKGROUND, CLEANUP_REASONS.EMERGENCY);
            } else if (nextAppState === 'active') {
                this.requestCleanup(CLEANUP_TRIGGERS.PERIODIC, CLEANUP_REASONS.ROUTINE);
            }
        });

        // Reduced frequency periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.requestCleanup(CLEANUP_TRIGGERS.PERIODIC, CLEANUP_REASONS.ROUTINE);
        }, 60 * 1000); // Increased to 60 seconds

        this.startMemoryMonitoring();
        logger.info('✅ AppMemoryManager initialized with single cleanup gate');
    }

    /**
     * SINGLE CLEANUP GATE: All cleanup requests route through here
     * Coalesces and debounces multiple requests within the debounce window
     */
    requestCleanup(trigger, reason = CLEANUP_REASONS.ROUTINE) {
        // Storm protection: auto-downgrade frequent emergency requests
        if (reason === CLEANUP_REASONS.EMERGENCY) {
            if (this.isStormProtectionActive()) {
                logger.warn('🛡️ Storm protection active - downgrading emergency to routine', {
                    trigger,
                    originalReason: reason
                });
                reason = CLEANUP_REASONS.ROUTINE;
                trigger = `${trigger}_downgraded`;
            } else {
                this.recordEmergencyRequest();
            }
        }

        // Add to pending reasons set
        this.pendingCleanupReasons.add(`${trigger}:${reason}`);

        logger.debug('🎯 Cleanup requested', {
            trigger,
            reason,
            pendingReasons: Array.from(this.pendingCleanupReasons),
            cleanupInProgress: this.cleanupInProgress
        });

        // If cleanup already in progress, just accumulate reasons
        if (this.cleanupInProgress) {
            logger.debug('⏳ Cleanup in progress - accumulating request', {
                trigger,
                reason,
                totalPending: this.pendingCleanupReasons.size
            });
            return;
        }

        // Clear existing debounce timer
        if (this.cleanupDebounceTimer) {
            clearTimeout(this.cleanupDebounceTimer);
        }

        // Start/restart debounce timer
        this.cleanupDebounceTimer = setTimeout(() => {
            this.executeCleanupBatch();
        }, this.cleanupDebounceDelay);
    }

    /**
     * Execute coalesced cleanup batch with telemetry
     */
    async executeCleanupBatch() {
        if (this.cleanupInProgress || this.pendingCleanupReasons.size === 0) {
            return;
        }

        this.cleanupInProgress = true;
        this.cleanupBatchId++;
        const batchId = `batch_${this.cleanupBatchId}_${Date.now()}`;

        // Capture and clear pending reasons
        const reasonsArray = Array.from(this.pendingCleanupReasons);
        this.pendingCleanupReasons.clear();

        // Determine effective cleanup level based on reasons
        const hasEmergency = reasonsArray.some(r => r.includes(':emergency'));
        const effectiveReason = hasEmergency ? CLEANUP_REASONS.EMERGENCY : CLEANUP_REASONS.ROUTINE;

        // Enhanced telemetry logging
        logger.info('🧹 Starting cleanup batch', {
            batchId,
            reasons: reasonsArray,
            effectiveReason,
            coalescedCount: reasonsArray.length,
            stormProtectionActive: this.stormProtectionActive
        });

        const batchStartTime = Date.now();

        try {
            // Notify all listeners for immediate cleanup (video pause, etc.)
            this.notifyListeners(effectiveReason);

            // Cancel background requests to prevent new memory allocation
            BackgroundDataService.cancelAllRequests?.();

            // Route to appropriate cleanup method based on effective reason
            if (effectiveReason === CLEANUP_REASONS.EMERGENCY) {
                await this.performEmergencyCleanup(batchId, reasonsArray);
            } else {
                await this.performRoutineCleanup(batchId, reasonsArray);
            }

            // Update last cleanup time
            this.lastCleanup = Date.now();

            // Force garbage collection for higher-priority cleanups
            if (hasEmergency && global.gc) {
                setTimeout(() => {
                    global.gc();
                    logger.debug('♻️ Post-batch garbage collection completed');
                }, 100);
            }

            const batchDuration = Date.now() - batchStartTime;
            logger.info('✅ Cleanup batch completed', {
                batchId,
                effectiveReason,
                duration: `${batchDuration}ms`,
                coalescedReasons: reasonsArray.length
            });

        } catch (error) {
            logger.error('❌ Cleanup batch failed', {
                batchId,
                effectiveReason,
                error: error.message,
                reasons: reasonsArray
            });
        } finally {
            this.cleanupInProgress = false;

            // Process any requests that accumulated during execution
            if (this.pendingCleanupReasons.size > 0) {
                logger.debug('🔄 Processing accumulated cleanup requests', {
                    pendingCount: this.pendingCleanupReasons.size
                });
                setTimeout(() => this.executeCleanupBatch(), 100);
            }
        }
    }

    /**
     * Routine cleanup for navigation, unfocus, periodic events
     */
    async performRoutineCleanup(batchId, reasons) {
        logger.info('🧹 Executing routine cleanup', { batchId, reasons });

        try {
            // Light-touch cache trimming from CacheManager
            await performRoutineCleanup(`batch:${reasons.join(',')}`);

            // Moderate cache size management (higher limits)
            const maxCacheSize = this.memoryPressureLevel === 'critical' ? 40 : 60;
            await manageCacheSize(maxCacheSize);

        } catch (error) {
            logger.error('❌ Routine cleanup error', {
                batchId,
                error: error.message,
                reasons
            });
        }
    }

    /**
     * Emergency cleanup for memory pressure, app backgrounding
     */
    async performEmergencyCleanup(batchId, reasons) {
        logger.warn('🚨 Executing emergency cleanup', { batchId, reasons });

        try {
            // Full cache clearing from CacheManager
            await clearAllCaches(`batch:${reasons.join(',')}`);

            // Aggressive cache size reduction
            await manageCacheSize(15); // Very low limit for emergency

            // Emergency video cleanup through background service
            if (BackgroundDataService.emergencyVideoCleanup) {
                await BackgroundDataService.emergencyVideoCleanup(`batch:${batchId}`);
            }

        } catch (error) {
            logger.error('❌ Emergency cleanup error', {
                batchId,
                error: error.message,
                reasons
            });
        }
    }

    /**
     * Notify all listeners for immediate component-level cleanup
     */
    notifyListeners(effectiveReason) {
        if (this.navigationListeners.size === 0) return;

        const cleanupType = effectiveReason === CLEANUP_REASONS.EMERGENCY ? 'emergency_cleanup' : 'routine_cleanup';

        logger.debug('📢 Notifying cleanup listeners', {
            listenerCount: this.navigationListeners.size,
            cleanupType
        });

        let notifiedCount = 0;
        let errorCount = 0;

        this.navigationListeners.forEach(listener => {
            try {
                listener(cleanupType);
                notifiedCount++;
            } catch (error) {
                errorCount++;
                logger.warn('⚠️ Listener notification error', {
                    error: error.message,
                    cleanupType
                });
            }
        });

        logger.debug('📢 Listener notifications completed', {
            notifiedCount,
            errorCount,
            cleanupType
        });
    }

    /**
     * Storm protection: track emergency requests and auto-downgrade
     */
    recordEmergencyRequest() {
        const now = Date.now();
        this.emergencyRequestTimes.push(now);

        // Clean old requests outside the window
        this.emergencyRequestTimes = this.emergencyRequestTimes.filter(
            time => (now - time) <= this.stormProtectionWindow
        );
    }

    isStormProtectionActive() {
        const now = Date.now();
        const recentRequests = this.emergencyRequestTimes.filter(
            time => (now - time) <= this.stormProtectionWindow
        );

        const shouldActivate = recentRequests.length >= this.maxEmergencyRequests;

        if (shouldActivate && !this.stormProtectionActive) {
            this.stormProtectionActive = true;
            logger.warn('🛡️ Storm protection activated', {
                recentEmergencyRequests: recentRequests.length,
                windowMs: this.stormProtectionWindow,
                threshold: this.maxEmergencyRequests
            });
        } else if (!shouldActivate && this.stormProtectionActive) {
            this.stormProtectionActive = false;
            logger.info('🛡️ Storm protection deactivated');
        }

        return this.stormProtectionActive;
    }

    /**
     * Navigation change handler - routes to single cleanup gate
     */
    async onNavigationChange(from, to) {
        const now = Date.now();

        // Prevent too frequent navigation cleanup
        if (now - this.lastNavigationCleanup < 500) return;
        this.lastNavigationCleanup = now;

        logger.debug('🧭 Navigation change detected', { from, to });

        // Request routine cleanup through single gate
        this.requestCleanup(CLEANUP_TRIGGERS.NAVIGATION, CLEANUP_REASONS.ROUTINE);
    }

    /**
     * Memory monitoring with automatic emergency requests
     */
    startMemoryMonitoring() {
        if (global.performance?.memory) {
            setInterval(() => {
                if (!this.isInitialized) return;

                try {
                    const heap = global.performance.memory;
                    const usedMB = heap.usedJSHeapSize / 1024 / 1024;
                    const limitMB = heap.jsHeapSizeLimit / 1024 / 1024;
                    const usagePercent = (usedMB / limitMB) * 100;

                    const oldLevel = this.memoryPressureLevel;

                    if (usagePercent > 85) {
                        this.memoryPressureLevel = 'critical';
                    } else if (usagePercent > 70) {
                        this.memoryPressureLevel = 'warning';
                    } else {
                        this.memoryPressureLevel = 'normal';
                    }

                    // Trigger emergency cleanup on critical memory pressure
                    if (this.memoryPressureLevel === 'critical' && oldLevel !== 'critical') {
                        logger.warn(`🚨 Critical memory pressure detected: ${usagePercent.toFixed(1)}%`);
                        this.requestCleanup(CLEANUP_TRIGGERS.MEMORY_PRESSURE, CLEANUP_REASONS.EMERGENCY);
                    }

                } catch (error) {
                    logger.warn('⚠️ Memory monitoring error', { error: error.message });
                }
            }, 15000);
        }

        // React Native memory warning listener
        if (typeof global.addEventListener === 'function') {
            try {
                global.addEventListener('memoryWarning', () => {
                    logger.warn('🚨 System memory warning received');
                    this.memoryPressureLevel = 'critical';
                    this.requestCleanup(CLEANUP_TRIGGERS.MEMORY_PRESSURE, CLEANUP_REASONS.EMERGENCY);
                });
            } catch (error) {
                logger.debug('Memory warning listener not available');
            }
        }
    }

    /**
     * Public API: Add cleanup listener (for video components, etc.)
     */
    addNavigationListener(listener) {
        this.navigationListeners.add(listener);
        logger.debug('📝 Navigation listener added', {
            totalListeners: this.navigationListeners.size
        });
    }

    removeNavigationListener(listener) {
        this.navigationListeners.delete(listener);
        logger.debug('📝 Navigation listener removed', {
            totalListeners: this.navigationListeners.size
        });
    }

    /**
     * Public API: Force immediate cleanup with specified reason
     */
    async forceCleanup(reason = CLEANUP_TRIGGERS.MANUAL) {
        logger.info(`🔧 Force cleanup requested: ${reason}`);
        this.requestCleanup(reason, CLEANUP_REASONS.EMERGENCY);
    }

    /**
     * Public API: Request routine cleanup (for screen unfocus, etc.)
     */
    requestRoutineCleanup(trigger) {
        this.requestCleanup(trigger, CLEANUP_REASONS.ROUTINE);
    }

    /**
     * Public API: Legacy clearAll method - routes to emergency cleanup
     */
    async clearAll(reason = 'legacy') {
        logger.info(`🔄 Legacy clearAll triggered: ${reason}`);
        this.requestCleanup(reason, CLEANUP_REASONS.EMERGENCY);
    }

    /**
     * Get enhanced cache and memory statistics
     */
    getSimpleCacheStats() {
        const loadingStatus = BackgroundDataService.getLoadingStatus?.() || {};

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
                isLoading: loadingStatus.isLoading || false,
                currentStage: loadingStatus.currentStage || 'idle',
                feedLoaded: loadingStatus.systems?.feed?.loaded || false,
                profileLoaded: loadingStatus.systems?.profile?.loaded || false,
                feedError: loadingStatus.systems?.feed?.hasError || false,
                profileError: loadingStatus.systems?.profile?.hasError || false,
                totalFeedVideos: loadingStatus.totalFeedVideos || 0,
                totalProfileVideos: loadingStatus.totalProfileVideos || 0
            },
            memory: memoryInfo,
            memoryPressure: this.memoryPressureLevel,
            navigationListeners: this.navigationListeners.size,
            cleanupGate: {
                inProgress: this.cleanupInProgress,
                pendingReasons: Array.from(this.pendingCleanupReasons),
                lastBatchId: this.cleanupBatchId,
                lastCleanup: this.lastCleanup,
                stormProtectionActive: this.stormProtectionActive,
                recentEmergencyRequests: this.emergencyRequestTimes.length
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get current memory and cleanup status
     */
    getMemoryStatus() {
        return {
            pressure: this.memoryPressureLevel,
            listenerCount: this.navigationListeners.size,
            lastCleanup: this.lastCleanup,
            lastNavigationCleanup: this.lastNavigationCleanup,
            cleanupInProgress: this.cleanupInProgress,
            pendingCleanupCount: this.pendingCleanupReasons.size,
            stormProtectionActive: this.stormProtectionActive
        };
    }

    /**
     * Graceful shutdown with cleanup completion
     */
    shutdown() {
        logger.warn('🚫 Shutting down AppMemoryManager');

        // Clear timers
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.cleanupDebounceTimer) {
            clearTimeout(this.cleanupDebounceTimer);
            this.cleanupDebounceTimer = null;
        }

        // Cancel requests
        BackgroundDataService.cancelAllRequests?.();

        // Clear listeners and state
        this.navigationListeners.clear();
        this.pendingCleanupReasons.clear();
        this.isInitialized = false;
        this.cleanupInProgress = false;

        logger.info('✅ AppMemoryManager shutdown completed');
    }
}

export default new AppMemoryManager();
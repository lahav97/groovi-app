import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { createLogger } from './Logger';

const logger = createLogger('CacheManager');

const CACHE_KEYS = {
    FEED_VIDEOS: 'feed_videos_cache',
    FEED_METADATA: 'feed_metadata_cache',
    USER_PROFILE: 'user_profile_cache',
    PROFILE_VIDEOS: 'profile_videos_cache',
    CACHE_TIMESTAMPS: 'cache_timestamps'
};

const CACHE_EXPIRY = {
    FEED_VIDEOS: 10 * 60 * 1000,
    USER_PROFILE: 30 * 60 * 1000,
    PROFILE_VIDEOS: 60 * 60 * 1000,
};

// Memory cache configuration
const memoryCache = new Map();
const memoryCacheExpiry = new Map();
const MEMORY_CACHE_TTL = 2 * 60 * 1000;
const MAX_MEMORY_CACHE_SIZE = 5;
const MAX_MEMORY_CACHE_MB = 10;

// Write queue and processing state
let writeQueue = [];
let isProcessing = false;
let activeWrites = 0;
let cleanupTimer = null;
let currentMemoryCacheSizeMB = 0;

// Graceful shutdown configuration
let isShuttingDown = false;
let gracefulShutdownInProgress = false;
let writeQueueDrainTimeoutMs = 2000;
let timestampWriteTimeoutMs = 500;

// Operation limits
const MAX_QUEUE_SIZE = 2;
const MAX_WRITE_OPERATIONS = 1;
const OPERATION_TIMEOUT = 2000;

/**
 * Memory cache retrieval with expiry handling
 */
const getFromMemoryCache = (key) => {
    const expiry = memoryCacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
        const oldData = memoryCache.get(key);
        if (oldData) {
            const estimatedSize = (JSON.stringify(oldData).length * 2) / 1024 / 1024;
            currentMemoryCacheSizeMB = Math.max(0, currentMemoryCacheSizeMB - estimatedSize);
            logger.debug('🗑️ Memory cache entry expired', {
                key,
                estimatedSize: `${estimatedSize.toFixed(2)}MB`,
                remainingSize: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
            });
        }

        memoryCache.delete(key);
        memoryCacheExpiry.delete(key);
        return null;
    }
    return memoryCache.get(key) || null;
};

/**
 * Memory cache storage with size limits and eviction
 */
const setMemoryCache = (key, data) => {
    const estimatedSizeMB = (JSON.stringify(data).length * 2) / 1024 / 1024;

    if (estimatedSizeMB > 5) {
        logger.warn(`📦 Data too large for memory cache: ${estimatedSizeMB.toFixed(2)}MB`, { key });
        return;
    }

    // Evict oldest entries if at limits
    let evictedCount = 0;
    while ((memoryCache.size >= MAX_MEMORY_CACHE_SIZE ||
        currentMemoryCacheSizeMB + estimatedSizeMB > MAX_MEMORY_CACHE_MB) &&
    memoryCache.size > 0) {

        const oldestKey = memoryCache.keys().next().value;
        const oldData = memoryCache.get(oldestKey);

        if (oldData) {
            const oldSize = (JSON.stringify(oldData).length * 2) / 1024 / 1024;
            currentMemoryCacheSizeMB = Math.max(0, currentMemoryCacheSizeMB - oldSize);
        }

        memoryCache.delete(oldestKey);
        memoryCacheExpiry.delete(oldestKey);
        evictedCount++;
    }

    if (evictedCount > 0) {
        logger.info(`🗑️ Evicted ${evictedCount} items from memory cache for space`);
    }

    memoryCache.set(key, data);
    memoryCacheExpiry.set(key, Date.now() + MEMORY_CACHE_TTL);
    currentMemoryCacheSizeMB += estimatedSizeMB;

    logger.debug(`💾 Memory cache updated`, {
        key,
        size: `${estimatedSizeMB.toFixed(2)}MB`,
        totalItems: memoryCache.size,
        totalSize: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
    });
};

/**
 * Light-touch memory cache cleanup for routine operations
 */
const lightMemoryCacheCleanup = (reason = 'routine') => {
    const sizeBefore = memoryCache.size;
    const mbBefore = currentMemoryCacheSizeMB;

    // Only clean expired entries and enforce soft limits
    const now = Date.now();
    const expiredKeys = [];

    memoryCacheExpiry.forEach((expiry, key) => {
        if (now > expiry) {
            expiredKeys.push(key);
        }
    });

    expiredKeys.forEach(key => {
        const oldData = memoryCache.get(key);
        if (oldData) {
            const oldSize = (JSON.stringify(oldData).length * 2) / 1024 / 1024;
            currentMemoryCacheSizeMB = Math.max(0, currentMemoryCacheSizeMB - oldSize);
        }
        memoryCache.delete(key);
        memoryCacheExpiry.delete(key);
    });

    // Soft enforcement of cache size limits
    if (currentMemoryCacheSizeMB > MAX_MEMORY_CACHE_MB * 0.8) {
        const oldestKeys = Array.from(memoryCache.keys()).slice(0, 2);
        oldestKeys.forEach(key => {
            const oldData = memoryCache.get(key);
            if (oldData) {
                const oldSize = (JSON.stringify(oldData).length * 2) / 1024 / 1024;
                currentMemoryCacheSizeMB = Math.max(0, currentMemoryCacheSizeMB - oldSize);
            }
            memoryCache.delete(key);
            memoryCacheExpiry.delete(key);
        });
    }

    const clearedItems = sizeBefore - memoryCache.size;
    const freedMemory = mbBefore - currentMemoryCacheSizeMB;

    if (clearedItems > 0) {
        logger.info(`🧹 Light memory cleanup completed`, {
            reason,
            clearedItems,
            freedMemory: `${freedMemory.toFixed(2)}MB`,
            remaining: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
        });
    }
};

/**
 * Emergency memory cache cleanup for critical situations
 */
const emergencyMemoryCacheCleanup = (reason = 'emergency') => {
    logger.warn(`🚨 Emergency memory cache cleanup: ${reason}`, {
        itemsBefore: memoryCache.size,
        sizeBefore: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
    });

    const sizeBefore = memoryCache.size;
    const mbBefore = currentMemoryCacheSizeMB;

    memoryCache.clear();
    memoryCacheExpiry.clear();
    currentMemoryCacheSizeMB = 0;

    logger.info(`✅ Emergency memory cleanup completed`, {
        reason,
        clearedItems: sizeBefore,
        freedMemory: `${mbBefore.toFixed(2)}MB`
    });

    // Force garbage collection if available
    if (global.gc) {
        setTimeout(() => {
            global.gc();
            logger.debug('♻️ Forced garbage collection after emergency cleanup');
        }, 100);
    }
};

/**
 * Drain write queue with timeout before destructive operations
 */
const drainWriteQueue = async (timeoutMs = writeQueueDrainTimeoutMs) => {
    if (writeQueue.length === 0) {
        return { drained: 0, dropped: 0 };
    }

    logger.info(`🚰 Draining write queue`, {
        pendingWrites: writeQueue.length,
        timeoutMs
    });

    const startTime = Date.now();
    let drained = 0;
    let dropped = 0;

    // Process queue with timeout
    while (writeQueue.length > 0 && (Date.now() - startTime) < timeoutMs) {
        if (activeWrites >= MAX_WRITE_OPERATIONS) {
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
        }

        const operation = writeQueue.shift();
        if (!operation) continue;

        activeWrites++;
        try {
            await Promise.race([
                operation.fn(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Drain timeout')), 1000)
                )
            ]);
            drained++;
        } catch (error) {
            logger.warn(`⚠️ Write operation failed during drain: ${operation.id}`, {
                error: error.message
            });
        } finally {
            activeWrites--;
        }
    }

    // Count remaining operations as dropped
    dropped = writeQueue.length;
    writeQueue = [];

    logger.info(`✅ Write queue drain completed`, {
        drained,
        dropped,
        timeElapsed: `${Date.now() - startTime}ms`
    });

    return { drained, dropped };
};

/**
 * Process write queue with enhanced error handling
 */
const processWriteQueue = async () => {
    if (isProcessing || isShuttingDown || writeQueue.length === 0) {
        return;
    }

    isProcessing = true;

    try {
        while (writeQueue.length > 0 && activeWrites < MAX_WRITE_OPERATIONS && !isShuttingDown) {
            const operation = writeQueue.shift();
            if (!operation) continue;

            activeWrites++;

            try {
                await Promise.race([
                    operation.fn(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Write timeout')), OPERATION_TIMEOUT)
                    )
                ]);
            } catch (error) {
                logger.error(`❌ Write operation failed: ${operation.id}`, { error: error.message });
            } finally {
                activeWrites--;
            }

            await new Promise(resolve => setTimeout(resolve, 5));
        }
    } finally {
        isProcessing = false;

        if (writeQueue.length > 0 && !isShuttingDown) {
            setTimeout(processWriteQueue, 15);
        }
    }
};

/**
 * Fast cache read with timeout
 */
const readCacheInstant = async (key, timeout = 500) => {
    // Check memory cache first
    const memoryData = getFromMemoryCache(key);
    if (memoryData) {
        return memoryData;
    }

    // Read from disk with timeout
    try {
        const promise = AsyncStorage.getItem(key);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cache read timeout')), timeout)
        );

        const result = await Promise.race([promise, timeoutPromise]);

        if (result) {
            const dataSize = (result.length * 2) / 1024 / 1024;
            if (dataSize < 3) {
                setMemoryCache(key, result);
            }
            logger.debug('💿 Disk cache hit', {
                key,
                size: `${dataSize.toFixed(2)}MB`
            });
        }

        return result;
    } catch (error) {
        logger.warn(`⚠️ Cache read failed: ${key}`, {
            error: error.message,
            timeout: `${timeout}ms`
        });
        return null;
    }
};

/**
 * Enhanced write operation queuing with shutdown protection
 */
const queueWriteOperation = (operation, operationId = null) => {
    if (isShuttingDown && !gracefulShutdownInProgress) {
        logger.warn('🚫 Write operation rejected - shutting down', { operationId });
        return Promise.reject(new Error('Cache manager shutting down'));
    }

    if (writeQueue.length >= MAX_QUEUE_SIZE) {
        writeQueue = writeQueue.slice(-1);
        logger.warn(`📦 Write queue trimmed to prevent memory issues`, {
            previousSize: writeQueue.length + 1,
            newSize: writeQueue.length
        });
    }

    const id = operationId || `write_${Date.now()}`;
    writeQueue = writeQueue.filter(op => op.id !== id);

    return new Promise((resolve, reject) => {
        writeQueue.push({
            id,
            fn: async () => {
                try {
                    const result = await operation();
                    logger.debug(`✅ Write operation completed: ${id}`);
                    resolve(result);
                } catch (error) {
                    logger.error(`❌ Write operation failed: ${id}`, {
                        error: error.message
                    });
                    reject(error);
                }
            }
        });

        logger.debug(`📝 Queued write operation: ${id}`, {
            queueSize: writeQueue.length,
            activeWrites
        });
        processWriteQueue();
    });
};

/**
 * Timestamp management functions
 */
const getCurrentTimestamp = () => Date.now();

const isCacheExpired = (timestamp, maxAge) => {
    return (getCurrentTimestamp() - timestamp) > maxAge;
};

const getCacheTimestamp = async (key) => {
    try {
        const timestamps = await readCacheInstant(CACHE_KEYS.CACHE_TIMESTAMPS);
        if (timestamps) {
            const parsed = JSON.parse(timestamps);
            return parsed[key] || null;
        }
        return null;
    } catch (error) {
        return null;
    }
};

/**
 * Timestamp-first caching: ensure timestamps are written atomically and first
 */
const setCacheTimestamp = async (key, timestamp = getCurrentTimestamp()) => {
    // Timestamps get priority queuing and faster timeout
    return new Promise((resolve, reject) => {
        const timestampOperation = {
            id: `timestamp_${key}`,
            fn: async () => {
                try {
                    const timestamps = await readCacheInstant(CACHE_KEYS.CACHE_TIMESTAMPS);
                    const parsed = timestamps ? JSON.parse(timestamps) : {};
                    parsed[key] = timestamp;

                    // Cleanup old timestamps
                    const keys = Object.keys(parsed);
                    if (keys.length > 10) {
                        const sorted = keys.sort((a, b) => parsed[a] - parsed[b]);
                        sorted.slice(0, 5).forEach(k => delete parsed[k]);
                        logger.info(`🗑️ Cleaned old timestamps: ${sorted.slice(0, 5).join(', ')}`);
                    }

                    await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));

                    // Cache if small
                    const dataSize = (JSON.stringify(parsed).length * 2) / 1024 / 1024;
                    if (dataSize < 1) {
                        setMemoryCache(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));
                    }

                    resolve();
                } catch (error) {
                    logger.error('❌ Error setting cache timestamp', { error: error.message });
                    reject(error);
                }
            }
        };

        // Add to front of queue for priority processing
        writeQueue.unshift(timestampOperation);
        processWriteQueue();

        // Timeout for timestamp writes
        setTimeout(() => {
            reject(new Error('Timestamp write timeout'));
        }, timestampWriteTimeoutMs);
    }).catch(() => {
        // Silent fail for timestamps - don't block operations
        logger.debug(`⚠️ Timestamp write failed for key: ${key}`);
    });
};

/**
 * Cache feed videos with timestamp-first policy
 */
export const cacheFeedVideos = (feedVideos, metadata = {}) => {
    logger.info(`🎬 Caching feed videos`, {
        videoCount: feedVideos.length,
        hasMetadata: Object.keys(metadata).length > 0
    });

    return queueWriteOperation(async () => {
        try {
            // Set timestamp FIRST - timestamp-first policy
            await setCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);

            const videosToCache = feedVideos.slice(0, 8);

            // Include profile pictures in cached data
            const minimalVideos = videosToCache.map(v => ({
                id: v.id,
                user_id: v.user_id,
                username: v.username,
                user: v.user,
                video_url: v.video_url || v.videoUrl,
                videoUrl: v.video_url || v.videoUrl,
                instruments: v.instruments,
                profilePicture: v.profilePicture, // Include profile picture
                likes: v.likes,
                comments: v.comments
            }));

            const videoData = JSON.stringify(minimalVideos);
            const metadataObj = {
                videoCount: minimalVideos.length,
                lastUpdated: getCurrentTimestamp(),
                type: 'feed_with_profiles', // Updated type to indicate profile pictures included
                cacheVersion: 2, // Version to invalidate old caches
                ...metadata
            };

            // Write to disk
            await AsyncStorage.setItem(CACHE_KEYS.FEED_VIDEOS, videoData);
            await AsyncStorage.setItem(CACHE_KEYS.FEED_METADATA, JSON.stringify(metadataObj));

            // Cache in memory if reasonable size
            const dataSize = (videoData.length * 2) / 1024 / 1024;
            if (dataSize < 3) {
                setMemoryCache(CACHE_KEYS.FEED_VIDEOS, videoData);
                setMemoryCache(CACHE_KEYS.FEED_METADATA, JSON.stringify(metadataObj));
            }

            logger.info(`✅ Feed videos cached successfully with profile pictures`, {
                videoCount: minimalVideos.length,
                dataSize: `${dataSize.toFixed(2)}MB`,
                profilePicturesIncluded: minimalVideos.filter(v => v.profilePicture).length
            });

        } catch (error) {
            logger.error('❌ Error caching feed videos', {
                error: error.message,
                videoCount: feedVideos.length
            });
        }
    }, 'cache_feed_videos');
};

/**
 * Get discover cache with timestamp validation
 */
export const getDiscoverCache = async () => {
    logger.debug('🔍 Retrieving discover cache');

    try {
        // Fast timestamp check first
        const timestamp = await getCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS)) {
            logger.info('📅 Feed cache expired or missing', {
                hasTimestamp: !!timestamp,
                expired: timestamp ? isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS) : true
            });
            return null;
        }

        // Check cache version in metadata
        const cachedMetadata = await readCacheInstant(CACHE_KEYS.FEED_METADATA);
        if (cachedMetadata) {
            try {
                const metadata = JSON.parse(cachedMetadata);
                // Check for cache version - invalidate old caches without profile pictures
                if (!metadata.cacheVersion || metadata.cacheVersion < 2) {
                    logger.info('🔄 Cache version outdated, invalidating old cache without profile pictures', {
                        oldVersion: metadata.cacheVersion || 1,
                        requiredVersion: 2
                    });
                    // Clear old cache asynchronously
                    queueWriteOperation(async () => {
                        await AsyncStorage.multiRemove([CACHE_KEYS.FEED_VIDEOS, CACHE_KEYS.FEED_METADATA]);
                        memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
                        memoryCache.delete(CACHE_KEYS.FEED_METADATA);
                    }, 'clear_old_cache_version').catch(() => {});
                    return null;
                }
            } catch (metadataError) {
                logger.warn('⚠️ Metadata parse error, treating as old cache', {
                    error: metadataError.message
                });
                return null;
            }
        }

        // Read cached data
        const cachedFeedVideos = await readCacheInstant(CACHE_KEYS.FEED_VIDEOS);
        if (cachedFeedVideos) {
            try {
                const feedVideos = JSON.parse(cachedFeedVideos);

                // Log profile picture status for debugging
                const videosWithProfiles = feedVideos.filter(v => v.profilePicture);
                logger.info(`✅ Feed cache loaded successfully with profile pictures`, {
                    videoCount: feedVideos.length,
                    profilePicturesLoaded: videosWithProfiles.length,
                    sampleProfilePicture: videosWithProfiles[0]?.profilePicture || 'none'
                });

                return feedVideos;
            } catch (parseError) {
                logger.error('💥 Feed cache corrupted, cleaning up', {
                    error: parseError.message
                });
                // Queue cleanup asynchronously
                queueWriteOperation(async () => {
                    await AsyncStorage.removeItem(CACHE_KEYS.FEED_VIDEOS);
                    memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
                }, 'cleanup_corrupt_feed').catch(() => {});
                return null;
            }
        }

        logger.info('🔭 Feed cache miss');
        return null;
    } catch (error) {
        logger.error('❌ Error getting feed cache', { error: error.message });
        return null;
    }
};

export const clearOldCacheVersion = async () => {
    logger.info('🗑️ Clearing old cache version to force refresh with profile pictures');

    return queueWriteOperation(async () => {
        try {
            // Clear all feed-related cache
            await AsyncStorage.multiRemove([
                CACHE_KEYS.FEED_VIDEOS,
                CACHE_KEYS.FEED_METADATA
            ]);

            // Clear from memory cache
            memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
            memoryCache.delete(CACHE_KEYS.FEED_METADATA);

            logger.info('✅ Old cache cleared successfully');
        } catch (error) {
            logger.error('❌ Error clearing old cache', { error: error.message });
        }
    }, 'clear_old_cache_version');
};

export const getFeedCache = getDiscoverCache;

/**
 * Light-touch feed cache clearing for routine operations
 */
export const clearFeedCache = () => {
    logger.info('🧹 Clearing feed cache');
    return queueWriteOperation(async () => {
        try {
            await AsyncStorage.multiRemove([
                CACHE_KEYS.FEED_VIDEOS,
                CACHE_KEYS.FEED_METADATA
            ]);

            memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
            memoryCache.delete(CACHE_KEYS.FEED_METADATA);

        } catch (error) {
            logger.error('❌ Error clearing feed cache', { error: error.message });
        }
    }, 'clear_feed_cache');
};

/**
 * Cache user profile with timestamp-first policy
 */
export const cacheUserProfile = (profileData, userEmail) => {
    logger.info(`👤 Caching user profile`, {
        userEmail,
        hasVideos: !!(profileData.videos && profileData.videos.length > 0)
    });

    return queueWriteOperation(async () => {
        try {
            const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;

            // Set timestamp FIRST
            await setCacheTimestamp(profileCacheKey);

            const minimalProfile = {
                username: profileData.username,
                email: profileData.email,
                bio: profileData.bio,
                instruments: profileData.instruments,
                location: profileData.location,
                age: profileData.age,
                rating: profileData.rating,
                followers: profileData.followers,
                following: profileData.following,
                likes: profileData.likes
            };

            const profileData_str = JSON.stringify(minimalProfile);
            await AsyncStorage.setItem(profileCacheKey, profileData_str);

            // Cache in memory if reasonable size
            const profileSize = (profileData_str.length * 2) / 1024 / 1024;
            if (profileSize < 1) {
                setMemoryCache(profileCacheKey, profileData_str);
            }

            if (profileData.videos && profileData.videos.length > 0) {
                const videosToCache = profileData.videos.slice(0, 4);
                const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
                const videosData = JSON.stringify(videosToCache);

                await AsyncStorage.setItem(profileVideosCacheKey, videosData);

                const videoSize = (videosData.length * 2) / 1024 / 1024;
                if (videoSize < 2) {
                    setMemoryCache(profileVideosCacheKey, videosData);
                }
                await setCacheTimestamp(profileVideosCacheKey);

                logger.debug(`🎬 Profile videos cached`, {
                    videoCount: videosToCache.length,
                    videoSize: `${videoSize.toFixed(2)}MB`
                });
            }

            logger.info(`✅ Profile cached successfully`, {
                userEmail,
                profileSize: `${profileSize.toFixed(2)}MB`,
                videoCount: profileData.videos?.length || 0
            });

        } catch (error) {
            logger.error(`❌ Error caching profile`, {
                userEmail,
                error: error.message
            });
        }
    }, `cache_profile_${userEmail}`);
};

/**
 * Get profile cache with timestamp validation
 */
export const getProfileCache = async (userEmail) => {
    logger.debug('🔍 Retrieving profile cache', { userEmail });

    try {
        const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;

        // Fast timestamp check
        const timestamp = await getCacheTimestamp(profileCacheKey);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.USER_PROFILE)) {
            logger.info(`📅 Profile cache expired`, {
                userEmail,
                hasTimestamp: !!timestamp
            });
            return null;
        }

        // Read cached profile
        const cachedProfile = await readCacheInstant(profileCacheKey);
        if (cachedProfile) {
            try {
                const profile = JSON.parse(cachedProfile);

                // Try to get videos too
                const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
                const videoTimestamp = await getCacheTimestamp(profileVideosCacheKey);

                if (videoTimestamp && !isCacheExpired(videoTimestamp, CACHE_EXPIRY.PROFILE_VIDEOS)) {
                    const cachedProfileVideos = await readCacheInstant(profileVideosCacheKey);
                    if (cachedProfileVideos) {
                        profile.videos = JSON.parse(cachedProfileVideos);
                        logger.debug(`🎬 Profile videos loaded from cache`, {
                            videoCount: profile.videos.length
                        });
                    }
                }

                logger.info(`✅ Profile cache loaded successfully`, {
                    userEmail,
                    hasVideos: !!(profile.videos && profile.videos.length > 0)
                });

                return profile;
            } catch (parseError) {
                logger.error(`💥 Profile cache corrupted`, {
                    userEmail,
                    error: parseError.message
                });
                // Queue cleanup asynchronously
                queueWriteOperation(async () => {
                    await AsyncStorage.removeItem(profileCacheKey);
                    memoryCache.delete(profileCacheKey);
                }, `cleanup_corrupt_profile_${userEmail}`).catch(() => {});

                return null;
            }
        }

        logger.info(`🔭 Profile cache miss`, { userEmail });
        return null;
    } catch (error) {
        logger.error(`❌ Error getting profile cache`, {
            userEmail,
            error: error.message
        });
        return null;
    }
};

/**
 * Clear profile cache for specific user
 */
export const clearProfileCache = (userEmail) => {
    logger.info(`🧹 Clearing profile cache for: ${userEmail}`);
    return queueWriteOperation(async () => {
        try {
            const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
            const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;

            await AsyncStorage.multiRemove([profileCacheKey, profileVideosCacheKey]);

            memoryCache.delete(profileCacheKey);
            memoryCache.delete(profileVideosCacheKey);

        } catch (error) {
            logger.error(`❌ Error clearing profile cache for ${userEmail}`, { error: error.message });
        }
    }, `clear_profile_${userEmail}`);
};

/**
 * ROUTINE CLEANUP: Light-touch cache trimming for navigation/periodic events
 */
export const performRoutineCleanup = async (reason = 'routine') => {
    logger.info(`🧹 Performing routine cleanup: ${reason}`);

    try {
        // Light memory cache cleanup (expired entries only)
        lightMemoryCacheCleanup(reason);

        // Trim write queue if overflowing
        if (writeQueue.length > MAX_QUEUE_SIZE) {
            const removed = writeQueue.length - MAX_QUEUE_SIZE;
            writeQueue = writeQueue.slice(-MAX_QUEUE_SIZE);
            logger.info(`📦 Trimmed write queue: removed ${removed} old operations`);
        }

        // Light disk cache management
        await manageCacheSize(50); // Higher limit for routine cleanup

        logger.info(`✅ Routine cleanup completed: ${reason}`);

    } catch (error) {
        logger.error('❌ Error during routine cleanup', {
            reason,
            error: error.message
        });
    }
};

/**
 * EMERGENCY CLEANUP: Full cache clearing for memory pressure situations
 */
export const clearAllCaches = async (reason = 'emergency') => {
    logger.warn('🚨 Emergency cache clearing initiated', { reason });

    gracefulShutdownInProgress = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    try {
        // Drain write queue before clearing
        const drainResult = await drainWriteQueue();
        logger.info(`🚰 Write queue drained`, drainResult);

        // Emergency memory cleanup
        emergencyMemoryCacheCleanup(reason);

        // Clear disk caches
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key =>
            key.includes('_cache') || key.includes('_metadata') || key.includes('_timestamps')
        );

        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
            logger.info(`💿 Cleared ${cacheKeys.length} disk cache entries`, {
                keys: cacheKeys.slice(0, 5).concat(cacheKeys.length > 5 ? ['...'] : [])
            });
        }

        // Clear video cache directory
        const videoCacheDir = `${FileSystem.cacheDirectory}videos`;
        try {
            const dirInfo = await FileSystem.getInfoAsync(videoCacheDir);
            if (dirInfo.exists) {
                await FileSystem.deleteAsync(videoCacheDir, { idempotent: true });
                logger.debug('🎬 Cleared video cache directory');
            }
        } catch (videoCacheError) {
            logger.warn('⚠️ Error clearing video cache directory', {
                error: videoCacheError.message
            });
        }

    } catch (error) {
        logger.error('❌ Error during emergency cleanup', {
            reason,
            error: error.message
        });
    } finally {
        gracefulShutdownInProgress = false;
    }

    // Force garbage collection
    if (global.gc) {
        global.gc();
        logger.debug('♻️ Forced garbage collection after emergency cleanup');
    }

    logger.info('✅ Emergency cleanup completed', { reason });
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.includes('_cache'));

        let totalSize = 0;
        const sampleKeys = cacheKeys.slice(0, 3);

        for (const key of sampleKeys) {
            const value = await readCacheInstant(key, 500);
            if (value) {
                totalSize += value.length;
            }
        }

        const stats = {
            totalKeys: cacheKeys.length,
            approximateSize: `${(totalSize / 1024).toFixed(2)} KB`,
            memoryCache: {
                items: memoryCache.size,
                sizeMB: currentMemoryCacheSizeMB.toFixed(2),
                maxItems: MAX_MEMORY_CACHE_SIZE,
                maxSizeMB: MAX_MEMORY_CACHE_MB
            },
            queueStatus: {
                pending: writeQueue.length,
                active: activeWrites,
                isShuttingDown,
                gracefulShutdownInProgress
            }
        };

        logger.info('📊 Cache statistics generated', stats);
        return stats;
    } catch (error) {
        logger.error('❌ Error getting cache stats', { error: error.message });
        return null;
    }
};

/**
 * Video cache size management with configurable limits
 */
export const manageCacheSize = async (maxCacheSizeMB = 30) => {
    logger.info('🧹 Managing cache size', { maxSize: `${maxCacheSizeMB}MB` });

    return queueWriteOperation(async () => {
        try {
            const maxCacheBytes = maxCacheSizeMB * 1024 * 1024;
            const videoCacheDir = `${FileSystem.cacheDirectory}videos`;

            const dirInfo = await FileSystem.getInfoAsync(videoCacheDir);
            if (!dirInfo.exists) {
                logger.debug('📁 Video cache directory does not exist');
                return;
            }

            let files;
            try {
                files = await FileSystem.readDirectoryAsync(videoCacheDir);
            } catch (readError) {
                if (readError.message.includes("doesn't exist")) {
                    logger.debug('📁 Directory disappeared during read, skipping cleanup');
                    return;
                }
                throw readError;
            }

            if (files.length === 0) {
                logger.debug('📁 Video cache directory is empty');
                return;
            }

            // Get file info
            const fileInfoPromises = files.map(async (filename) => {
                const fileUri = `${videoCacheDir}/${filename}`;
                try {
                    const info = await FileSystem.getInfoAsync(fileUri);
                    return {
                        uri: fileUri,
                        name: filename,
                        modTime: info.modificationTime || 0,
                        size: info.size || 0
                    };
                } catch (error) {
                    return null;
                }
            });

            const filesWithInfo = (await Promise.all(fileInfoPromises)).filter(Boolean);
            const totalSize = filesWithInfo.reduce((sum, file) => sum + file.size, 0);

            logger.info(`📊 Video cache analysis`, {
                fileCount: files.length,
                totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
                maxSize: `${maxCacheSizeMB}MB`,
                needsCleanup: totalSize > maxCacheBytes
            });

            if (totalSize > maxCacheBytes) {
                // Sort by modification time (oldest first)
                const sortedFiles = filesWithInfo.sort((a, b) => a.modTime - b.modTime);

                let currentSize = totalSize;
                let deletedCount = 0;

                for (const file of sortedFiles) {
                    if (currentSize <= maxCacheBytes) break;

                    try {
                        await FileSystem.deleteAsync(file.uri);
                        currentSize -= file.size;
                        deletedCount++;
                    } catch (deleteError) {
                        logger.warn(`❌ Failed to delete cache file`, {
                            fileName: file.name,
                            error: deleteError.message
                        });
                    }
                }

                const savedMB = (totalSize - currentSize) / 1024 / 1024;
                logger.info(`✅ Cache cleanup completed`, {
                    deletedFiles: deletedCount,
                    freedSpace: `${savedMB.toFixed(2)}MB`,
                    remainingSize: `${(currentSize / 1024 / 1024).toFixed(2)}MB`
                });
            }
        } catch (error) {
            logger.error('❌ Error managing cache size', {
                error: error.message,
                maxSize: `${maxCacheSizeMB}MB`
            });
        }
    }, 'manage_cache_size');
};

/**
 * Force memory cleanup - called from AppMemoryManager
 */
export const forceMemoryCleanup = (reason = 'unknown') => {
    emergencyMemoryCacheCleanup(reason);
};

/**
 * Periodic cleanup with reduced frequency
 */
const startPeriodicCleanup = () => {
    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
    }

    cleanupTimer = setTimeout(() => {
        if (!isShuttingDown) {
            // Use routine cleanup instead of emergency
            performRoutineCleanup('periodic');
            startPeriodicCleanup();
        }
    }, 30000); // Increased to 30 seconds for less aggressive cleanup
};

/**
 * Graceful shutdown with write queue draining
 */
export const shutdownCacheManager = async () => {
    logger.warn('🚫 Shutting down cache manager');
    isShuttingDown = true;
    gracefulShutdownInProgress = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    // Drain write queue before shutdown
    await drainWriteQueue();

    activeWrites = 0;
    isProcessing = false;

    emergencyMemoryCacheCleanup('shutdown');

    gracefulShutdownInProgress = false;
    logger.info('✅ Cache manager shutdown completed');
};

startPeriodicCleanup();
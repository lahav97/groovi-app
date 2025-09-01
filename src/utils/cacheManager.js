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

// REDUCED MEMORY CACHE - Much smaller to prevent 2GB leaks
const memoryCache = new Map();
const memoryCacheExpiry = new Map();
const MEMORY_CACHE_TTL = 2 * 60 * 1000; // Reduced to 2 minutes
const MAX_MEMORY_CACHE_SIZE = 5; // Reduced from 20 to 5 items
const MAX_MEMORY_CACHE_MB = 10; // Max 10MB in memory cache

let writeQueue = [];
let isProcessing = false;
let activeWrites = 0;
let cleanupTimer = null;
let isShuttingDown = false;
let currentMemoryCacheSizeMB = 0;

const MAX_QUEUE_SIZE = 2; // Reduced from 3
const MAX_WRITE_OPERATIONS = 1;
const OPERATION_TIMEOUT = 2000; // Reduced timeout

/**
 * ENHANCED: Memory cache with size tracking
 */
const getFromMemoryCache = (key) => {
    const expiry = memoryCacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
        const oldData = memoryCache.get(key);
        if (oldData) {
            // Estimate and subtract size
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
 * ENHANCED: Memory cache with aggressive size limits
 */
const setMemoryCache = (key, data) => {
    // Estimate data size in MB
    const estimatedSizeMB = (JSON.stringify(data).length * 2) / 1024 / 1024;
    
    // Check if data is too large for cache
    if (estimatedSizeMB > 5) {
        logger.warn(`📦 Data too large for memory cache: ${estimatedSizeMB.toFixed(2)}MB`, { key });
        return;
    }

    // Clean cache if at limits
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

    // Add new data
    memoryCache.set(key, data);
    memoryCacheExpiry.set(key, Date.now() + MEMORY_CACHE_TTL);
    currentMemoryCacheSizeMB += estimatedSizeMB;
    
    if (__DEV__) {
        logger.debug(`💾 Memory cache updated`, {
            key,
            size: `${estimatedSizeMB.toFixed(2)}MB`,
            totalItems: memoryCache.size,
            totalSize: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
        });
    }
};

/**
 * ENHANCED: Aggressive memory cache cleanup
 */
const forceMemoryCacheCleanup = (reason = 'unknown') => {
    logger.warn(`🧹 Force cleaning memory cache: ${reason}`, {
        itemsBefore: memoryCache.size,
        sizeBefore: `${currentMemoryCacheSizeMB.toFixed(2)}MB`
    });

    const sizeBefore = memoryCache.size;
    const mbBefore = currentMemoryCacheSizeMB;
    
    memoryCache.clear();
    memoryCacheExpiry.clear();
    currentMemoryCacheSizeMB = 0;
    
    logger.info(`✅ Memory cache cleared successfully`, {
        reason,
        clearedItems: sizeBefore,
        freedMemory: `${mbBefore.toFixed(2)}MB`
    });

    // Force garbage collection if available
    if (global.gc) {
        setTimeout(() => {
            global.gc();
            logger.debug('♻️ Forced garbage collection after cache cleanup');
        }, 100);
    }
};

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

const readCacheInstant = async (key, timeout = 500) => {
    // Check memory cache first
    const memoryData = getFromMemoryCache(key);
    if (memoryData) {
        return memoryData;
    }

    // Read from disk
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

const queueWriteOperation = (operation, operationId = null) => {
    if (isShuttingDown) {
        logger.warn('🚫 Write operation rejected - shutting down', { operationId });
        return Promise.reject(new Error('Cache manager shutting down'));
    }

    if (writeQueue.length >= MAX_QUEUE_SIZE) {
        writeQueue = writeQueue.slice(-1);
        logger.warn(`📦 Write queue full, trimmed to prevent memory issues`, {
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

        if (__DEV__) {
            logger.debug(`📝 Queued write operation: ${id}`, {
                queueSize: writeQueue.length,
                activeWrites
            });
        }
        processWriteQueue();
    });
};

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

const setCacheTimestamp = (key, timestamp = getCurrentTimestamp()) => {
    // Fire and forget - don't block for timestamp updates
    queueWriteOperation(async () => {
        try {
            const timestamps = await readCacheInstant(CACHE_KEYS.CACHE_TIMESTAMPS);
            const parsed = timestamps ? JSON.parse(timestamps) : {};
            parsed[key] = timestamp;

            const keys = Object.keys(parsed);
            if (keys.length > 10) { // Reduced from 15
                const sorted = keys.sort((a, b) => parsed[a] - parsed[b]);
                sorted.slice(0, 5).forEach(k => delete parsed[k]); // More aggressive cleanup
                logger.info(`Cleaned old timestamps: ${sorted.slice(0, 5).join(', ')}`);
            }

            await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));

            // Only cache if small
            const dataSize = (JSON.stringify(parsed).length * 2) / 1024 / 1024;
            if (dataSize < 1) {
                setMemoryCache(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));
            }

        } catch (error) {
            logger.error('Error setting cache timestamp', error.message);
        }
    }, `timestamp_${key}`).catch(() => {
        // Silent fail for timestamps
    });
};

export const cacheFeedVideos = (feedVideos, metadata = {}) => {
    logger.info(`🎬 Caching feed videos`, {
        videoCount: feedVideos.length,
        hasMetadata: Object.keys(metadata).length > 0
    });

    return queueWriteOperation(async () => {
        try {
            const videosToCache = feedVideos.slice(0, 8); // Reduced from 12

            const minimalVideos = videosToCache.map(v => ({
                id: v.id,
                user_id: v.user_id,
                username: v.username,
                video_url: v.video_url || v.videoUrl,
                instruments: v.instruments
            }));

            const videoData = JSON.stringify(minimalVideos);
            const metadataObj = {
                videoCount: minimalVideos.length,
                lastUpdated: getCurrentTimestamp(),
                type: 'feed_only',
                ...metadata
            };

            // Write to disk
            await AsyncStorage.setItem(CACHE_KEYS.FEED_VIDEOS, videoData);
            await AsyncStorage.setItem(CACHE_KEYS.FEED_METADATA, JSON.stringify(metadataObj));

            // Only cache in memory if reasonable size
            const dataSize = (videoData.length * 2) / 1024 / 1024;
            if (dataSize < 3) {
                setMemoryCache(CACHE_KEYS.FEED_VIDEOS, videoData);
                setMemoryCache(CACHE_KEYS.FEED_METADATA, JSON.stringify(metadataObj));
            }

            setCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);

            logger.info(`✅ Feed videos cached successfully`, {
                videoCount: minimalVideos.length,
                dataSize: `${dataSize.toFixed(2)}MB`
            });

        } catch (error) {
            logger.error('❌ Error caching feed videos', {
                error: error.message,
                videoCount: feedVideos.length
            });
        }
    }, 'cache_feed_videos');
};

export const getDiscoverCache = async () => {
    logger.debug('🔍 Retrieving discover cache');

    try {
        // Ultra-fast timestamp check
        const timestamp = await getCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS)) {
            logger.info('📅 Feed cache expired or missing', {
                hasTimestamp: !!timestamp,
                expired: timestamp ? isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS) : true
            });
            return null;
        }

        // Instant cache read (memory first, then disk)
        const cachedFeedVideos = await readCacheInstant(CACHE_KEYS.FEED_VIDEOS);
        if (cachedFeedVideos) {
            try {
                const feedVideos = JSON.parse(cachedFeedVideos);
                logger.info(`✅ Feed cache loaded successfully`, {
                    videoCount: feedVideos.length
                });
                return feedVideos;
            } catch (parseError) {
                logger.error('💥 Feed cache corrupted, cleaning up', {
                    error: parseError.message
                });
                // Queue cleanup asynchronously - don't block
                queueWriteOperation(async () => {
                    await AsyncStorage.removeItem(CACHE_KEYS.FEED_VIDEOS);
                    memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
                }, 'cleanup_corrupt_feed').catch(() => {});
                return null;
            }
        }

        logger.info('📭 Feed cache miss');
        return null;
    } catch (error) {
        logger.error('❌ Error getting feed cache', { error: error.message });
        return null;
    }
};

export const getFeedCache = getDiscoverCache;

export const clearFeedCache = () => {
    logger.info('🧹 Clearing feed cache');
    return queueWriteOperation(async () => {
        try {
            await AsyncStorage.multiRemove([
                CACHE_KEYS.FEED_VIDEOS,
                CACHE_KEYS.FEED_METADATA
            ]);

            // Clear from memory cache too
            memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
            memoryCache.delete(CACHE_KEYS.FEED_METADATA);

        } catch (error) {
            logger.error('❌ Error clearing feed cache', { error: error.message });
        }
    }, 'clear_feed_cache');
};

export const cacheUserProfile = (profileData, userEmail) => {
    logger.info(`👤 Caching user profile`, {
        userEmail,
        hasVideos: !!(profileData.videos && profileData.videos.length > 0)
    });

    return queueWriteOperation(async () => {
        try {
            const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;

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

            // Only cache in memory if reasonable size
            const profileSize = (profileData_str.length * 2) / 1024 / 1024;
            if (profileSize < 1) {
                setMemoryCache(profileCacheKey, profileData_str);
            }

            if (profileData.videos && profileData.videos.length > 0) {
                const videosToCache = profileData.videos.slice(0, 4); // Reduced from 6
                const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
                const videosData = JSON.stringify(videosToCache);

                await AsyncStorage.setItem(profileVideosCacheKey, videosData);
                
                const videoSize = (videosData.length * 2) / 1024 / 1024;
                if (videoSize < 2) {
                    setMemoryCache(profileVideosCacheKey, videosData);
                }
                setCacheTimestamp(profileVideosCacheKey);

                logger.debug(`🎬 Profile videos cached`, {
                    videoCount: videosToCache.length,
                    videoSize: `${videoSize.toFixed(2)}MB`
                });
            }

            setCacheTimestamp(profileCacheKey);

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

export const getProfileCache = async (userEmail) => {
    logger.debug('🔍 Retrieving profile cache', { userEmail });

    try {
        const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;

        // Ultra-fast timestamp check
        const timestamp = await getCacheTimestamp(profileCacheKey);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.USER_PROFILE)) {
            logger.info(`📅 Profile cache expired`, {
                userEmail,
                hasTimestamp: !!timestamp
            });
            return null;
        }

        // Instant cache read
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

        logger.info(`📭 Profile cache miss`, { userEmail });
        return null;
    } catch (error) {
        logger.error(`❌ Error getting profile cache`, {
            userEmail,
            error: error.message
        });
        return null;
    }
};

export const clearProfileCache = (userEmail) => {
    logger.info(`🧹 Clearing profile cache for: ${userEmail}`);
    return queueWriteOperation(async () => {
        try {
            const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
            const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;

            await AsyncStorage.multiRemove([profileCacheKey, profileVideosCacheKey]);

            // Clear from memory cache too
            memoryCache.delete(profileCacheKey);
            memoryCache.delete(profileVideosCacheKey);

        } catch (error) {
            logger.error(`❌ Error clearing profile cache for ${userEmail}`, { error: error.message });
        }
    }, `clear_profile_${userEmail}`);
};

/**
 * ENHANCED: Emergency cache clearing with memory cleanup
 */
export const clearAllCaches = async () => {
    logger.warn('🧹 Clearing ALL caches (emergency operation)');
    isShuttingDown = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    writeQueue = [];
    activeWrites = 0;
    isProcessing = false;

    // Force clear memory cache first
    forceMemoryCacheCleanup('clear_all_caches');

    try {
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
        logger.error('❌ Error clearing all caches', { error: error.message });
    }

    isShuttingDown = false;
    
    // Force garbage collection
    if (global.gc) {
        global.gc();
        logger.debug('♻️ Forced garbage collection after cache clear');
    }

    logger.info('✅ All caches cleared successfully');
};

export const getCacheStats = async () => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.includes('_cache'));

        let totalSize = 0;
        const sampleKeys = cacheKeys.slice(0, 3); // Reduced sample

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
                active: activeWrites
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
 * ENHANCED: More aggressive video cache management
 */
export const manageCacheSize = async (maxCacheSizeMB = 30) => { // Reduced default
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

            const files = await FileSystem.readDirectoryAsync(videoCacheDir);
            
            if (files.length === 0) {
                logger.debug('📁 Video cache directory is empty');
                return;
            }

            // Get all file info at once
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
                
                // Delete older files until under limit
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
 * NEW: Force memory cleanup - called from AppMemoryManager
 */
export const forceMemoryCleanup = (reason = 'unknown') => {
    forceMemoryCacheCleanup(reason);
};

/**
 * ENHANCED: More frequent cleanup
 */
const startPeriodicCleanup = () => {
    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
    }

    cleanupTimer = setTimeout(() => {
        if (!isShuttingDown) {
            // Clean write queue more aggressively
            if (writeQueue.length > MAX_QUEUE_SIZE) {
                const removed = writeQueue.length - MAX_QUEUE_SIZE;
                writeQueue = writeQueue.slice(-MAX_QUEUE_SIZE);
                logger.warn(`Queue cleanup: removed ${removed} old operations`);
            }

            // Clean memory cache more aggressively
            if (memoryCache.size > MAX_MEMORY_CACHE_SIZE || currentMemoryCacheSizeMB > MAX_MEMORY_CACHE_MB) {
                forceMemoryCacheCleanup('periodic_cleanup');
            }

            startPeriodicCleanup();
        }
    }, 10000); // Reduced from 20 seconds to 10 seconds
};

export const shutdownCacheManager = () => {
    logger.warn('🚫 Shutting down cache manager');
    isShuttingDown = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    writeQueue = [];
    activeWrites = 0;
    isProcessing = false;

    forceMemoryCacheCleanup('shutdown');
    clearAllCaches();
};

startPeriodicCleanup();
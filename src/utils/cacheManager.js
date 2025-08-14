import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

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

// INSTANT MEMORY CACHE - TikTok/Instagram style
const memoryCache = new Map();
const memoryCacheExpiry = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in memory

let writeQueue = [];
let isProcessing = false;
let activeWrites = 0;
let cleanupTimer = null;
let isShuttingDown = false;

const MAX_QUEUE_SIZE = 3;
const MAX_WRITE_OPERATIONS = 1;
const OPERATION_TIMEOUT = 3000;

const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] CACHE`;

    if (level === 'info') {
        console.log(`${prefix} ℹ️ ${message}`, data || '');
    } else if (level === 'warn') {
        console.warn(`${prefix} ⚠️ ${message}`, data || '');
    } else if (level === 'error') {
        console.error(`${prefix} ❌ ${message}`, data || '');
    } else if (level === 'perf') {
        console.log(`${prefix} ⚡ ${message}`, data || '');
    }
};

const getFromMemoryCache = (key) => {
    const expiry = memoryCacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
        memoryCache.delete(key);
        memoryCacheExpiry.delete(key);
        return null;
    }
    return memoryCache.get(key) || null;
};

const setMemoryCache = (key, data) => {
    memoryCache.set(key, data);
    memoryCacheExpiry.set(key, Date.now() + MEMORY_CACHE_TTL);

    // Keep memory cache size reasonable
    if (memoryCache.size > 20) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
        memoryCacheExpiry.delete(oldestKey);
    }
};

const processWriteQueue = async () => {
    if (isProcessing || isShuttingDown || writeQueue.length === 0) {
        return;
    }

    isProcessing = true;
    log('perf', `Processing ${writeQueue.length} write operations`);

    try {
        while (writeQueue.length > 0 && activeWrites < MAX_WRITE_OPERATIONS && !isShuttingDown) {
            const operation = writeQueue.shift();
            if (!operation) continue;

            activeWrites++;
            const startTime = Date.now();

            try {
                await Promise.race([
                    operation.fn(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Write timeout')), OPERATION_TIMEOUT)
                    )
                ]);

                log('perf', `Write operation completed: ${operation.id}`, `${Date.now() - startTime}ms`);
            } catch (error) {
                log('error', `Write operation failed: ${operation.id}`, error.message);
            } finally {
                activeWrites--;
            }

            await new Promise(resolve => setTimeout(resolve, 10));
        }
    } finally {
        isProcessing = false;

        if (writeQueue.length > 0 && !isShuttingDown) {
            setTimeout(processWriteQueue, 25);
        }
    }
};

const readCacheInstant = async (key, timeout = 800) => {
    const startTime = Date.now();

    // STEP 1: Check memory cache first (instant)
    const memoryData = getFromMemoryCache(key);
    if (memoryData) {
        log('perf', `Memory cache HIT: ${key}`, `${Date.now() - startTime}ms`);
        return memoryData;
    }

    // STEP 2: Read from disk (fast)
    try {
        const promise = AsyncStorage.getItem(key);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Cache read timeout')), timeout)
        );

        const result = await Promise.race([promise, timeoutPromise]);

        if (result) {
            // Cache in memory for next time
            setMemoryCache(key, result);
            log('perf', `Disk cache HIT: ${key}`, `${Date.now() - startTime}ms`);
        } else {
            log('info', `Cache MISS: ${key}`);
        }

        return result;
    } catch (error) {
        log('warn', `Cache read failed: ${key}`, error.message);
        return null;
    }
};

const queueWriteOperation = (operation, operationId = null) => {
    if (isShuttingDown) {
        log('warn', 'Write operation rejected - shutting down');
        return Promise.reject(new Error('Cache manager shutting down'));
    }

    if (writeQueue.length >= MAX_QUEUE_SIZE) {
        writeQueue = writeQueue.slice(-2);
        log('warn', `Write queue full, trimmed to ${writeQueue.length} operations`);
    }

    const id = operationId || `write_${Date.now()}`;
    writeQueue = writeQueue.filter(op => op.id !== id);

    return new Promise((resolve, reject) => {
        writeQueue.push({
            id,
            fn: async () => {
                try {
                    const result = await operation();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }
        });

        log('info', `Queued write operation: ${id}`, `Queue size: ${writeQueue.length}`);
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
            if (keys.length > 15) {
                const sorted = keys.sort((a, b) => parsed[a] - parsed[b]);
                sorted.slice(0, 3).forEach(k => delete parsed[k]);
                log('info', `Cleaned old timestamps: ${sorted.slice(0, 3).join(', ')}`);
            }

            await AsyncStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));

            // Update memory cache too
            setMemoryCache(CACHE_KEYS.CACHE_TIMESTAMPS, JSON.stringify(parsed));

        } catch (error) {
            log('error', 'Error setting cache timestamp', error.message);
        }
    }, `timestamp_${key}`).catch(() => {
        // Silent fail for timestamps
    });
};

export const cacheFeedVideos = (feedVideos, metadata = {}) => {
    log('info', `Caching ${feedVideos.length} feed videos`);

    return queueWriteOperation(async () => {
        try {
            const videosToCache = feedVideos.slice(0, 12);

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

            // Update memory cache immediately
            setMemoryCache(CACHE_KEYS.FEED_VIDEOS, videoData);
            setMemoryCache(CACHE_KEYS.FEED_METADATA, JSON.stringify(metadataObj));

            setCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);

            log('perf', `Feed videos cached successfully: ${minimalVideos.length} videos`);

        } catch (error) {
            log('error', 'Error caching feed videos', error.message);
        }
    }, 'cache_feed_videos');
};

export const getDiscoverCache = async () => {
    const startTime = Date.now();

    try {
        // Ultra-fast timestamp check
        const timestamp = await getCacheTimestamp(CACHE_KEYS.FEED_VIDEOS);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.FEED_VIDEOS)) {
            log('info', 'Feed cache expired or missing');
            return null;
        }

        // Instant cache read (memory first, then disk)
        const cachedFeedVideos = await readCacheInstant(CACHE_KEYS.FEED_VIDEOS);
        if (cachedFeedVideos) {
            try {
                const feedVideos = JSON.parse(cachedFeedVideos);
                log('perf', `Feed cache loaded: ${feedVideos.length} videos`, `${Date.now() - startTime}ms`);
                return feedVideos;
            } catch (parseError) {
                log('error', 'Feed cache corrupted, cleaning up');
                // Queue cleanup asynchronously - don't block
                queueWriteOperation(async () => {
                    await AsyncStorage.removeItem(CACHE_KEYS.FEED_VIDEOS);
                    memoryCache.delete(CACHE_KEYS.FEED_VIDEOS);
                }, 'cleanup_corrupt_feed').catch(() => {});
                return null;
            }
        }

        log('info', 'Feed cache miss');
        return null;
    } catch (error) {
        log('error', 'Error getting feed cache', error.message);
        return null;
    }
};

export const getFeedCache = getDiscoverCache;

export const clearFeedCache = () => {
    log('info', 'Clearing feed cache');
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
            log('error', 'Error clearing feed cache', error.message);
        }
    }, 'clear_feed_cache');
};

export const cacheUserProfile = (profileData, userEmail) => {
    log('info', `Caching profile for: ${userEmail}`);

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

            // Update memory cache immediately
            setMemoryCache(profileCacheKey, profileData_str);

            if (profileData.videos && profileData.videos.length > 0) {
                const videosToCache = profileData.videos.slice(0, 6);
                const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;
                const videosData = JSON.stringify(videosToCache);

                await AsyncStorage.setItem(profileVideosCacheKey, videosData);
                setMemoryCache(profileVideosCacheKey, videosData);
                setCacheTimestamp(profileVideosCacheKey);
            }

            setCacheTimestamp(profileCacheKey);
            log('perf', `Profile cached for: ${userEmail}`);

        } catch (error) {
            log('error', `Error caching profile for ${userEmail}`, error.message);
        }
    }, `cache_profile_${userEmail}`);
};

export const getProfileCache = async (userEmail) => {
    const startTime = Date.now();

    try {
        const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;

        // Ultra-fast timestamp check
        const timestamp = await getCacheTimestamp(profileCacheKey);
        if (!timestamp || isCacheExpired(timestamp, CACHE_EXPIRY.USER_PROFILE)) {
            log('info', `Profile cache expired for: ${userEmail}`);
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
                    }
                }

                log('perf', `Profile cache loaded for: ${userEmail}`, `${Date.now() - startTime}ms`);
                return profile;
            } catch (parseError) {
                log('error', `Profile cache corrupted for: ${userEmail}`);
                // Queue cleanup asynchronously
                queueWriteOperation(async () => {
                    await AsyncStorage.removeItem(profileCacheKey);
                    memoryCache.delete(profileCacheKey);
                }, `cleanup_corrupt_profile_${userEmail}`).catch(() => {});
                return null;
            }
        }

        log('info', `Profile cache miss for: ${userEmail}`);
        return null;
    } catch (error) {
        log('error', `Error getting profile cache for ${userEmail}`, error.message);
        return null;
    }
};

export const clearProfileCache = (userEmail) => {
    log('info', `Clearing profile cache for: ${userEmail}`);
    return queueWriteOperation(async () => {
        try {
            const profileCacheKey = `${CACHE_KEYS.USER_PROFILE}_${userEmail}`;
            const profileVideosCacheKey = `${CACHE_KEYS.PROFILE_VIDEOS}_${userEmail}`;

            await AsyncStorage.multiRemove([profileCacheKey, profileVideosCacheKey]);

            // Clear from memory cache too
            memoryCache.delete(profileCacheKey);
            memoryCache.delete(profileVideosCacheKey);

        } catch (error) {
            log('error', `Error clearing profile cache for ${userEmail}`, error.message);
        }
    }, `clear_profile_${userEmail}`);
};

export const clearAllCaches = async () => {
    log('warn', 'Clearing ALL caches');
    isShuttingDown = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    writeQueue = [];
    activeWrites = 0;
    isProcessing = false;

    // Clear memory cache immediately
    memoryCache.clear();
    memoryCacheExpiry.clear();

    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key =>
            key.includes('_cache') || key.includes('_metadata') || key.includes('_timestamps')
        );

        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
            log('perf', `Cleared ${cacheKeys.length} cache entries`);
        }
    } catch (error) {
        log('error', 'Error clearing all caches', error.message);
    }

    isShuttingDown = false;
};

export const getCacheStats = async () => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const cacheKeys = allKeys.filter(key => key.includes('_cache'));

        let totalSize = 0;
        const sampleKeys = cacheKeys.slice(0, 5);

        for (const key of sampleKeys) {
            const value = await readCacheInstant(key, 1000);
            if (value) {
                totalSize += value.length;
            }
        }

        return {
            totalKeys: cacheKeys.length,
            approximateSize: `${(totalSize / 1024).toFixed(2)} KB`,
            queueStatus: {
                pending: writeQueue.length,
                active: activeWrites
            }
        };
    } catch (error) {
        return null;
    }
};

export const manageCacheSize = async (maxCacheSizeMB = 50) => {
    // FIXED: Use correct function name
    return queueWriteOperation(async () => {
        try {
            const maxCacheBytes = maxCacheSizeMB * 1024 * 1024;
            const videoCacheDir = `${FileSystem.cacheDirectory}videos`;

            const dirInfo = await FileSystem.getInfoAsync(videoCacheDir);
            if (!dirInfo.exists) return;

            const files = await FileSystem.readDirectoryAsync(videoCacheDir);

            const batchSize = 8;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);

                const fileInfoPromises = batch.map(async (filename) => {
                    const fileUri = `${videoCacheDir}/${filename}`;
                    const info = await FileSystem.getInfoAsync(fileUri);
                    return {
                        uri: fileUri,
                        name: filename,
                        modTime: info.modificationTime || 0,
                        size: info.size || 0
                    };
                });

                const filesWithInfo = await Promise.all(fileInfoPromises);
                const totalSize = filesWithInfo.reduce((sum, file) => sum + file.size, 0);

                if (totalSize > maxCacheBytes) {
                    const sortedFiles = filesWithInfo.sort((a, b) => a.modTime - b.modTime);
                    const toDelete = sortedFiles.slice(0, Math.floor(sortedFiles.length / 3));

                    for (const file of toDelete) {
                        try {
                            await FileSystem.deleteAsync(file.uri);
                        } catch (deleteError) {
                            // Continue cleanup
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error managing cache size:', error);
        }
    }, 'manage_cache_size');
};

const startPeriodicCleanup = () => {
    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
    }

    cleanupTimer = setTimeout(() => {
        if (!isShuttingDown) {
            // Clean write queue
            if (writeQueue.length > MAX_QUEUE_SIZE) {
                const removed = writeQueue.length - MAX_QUEUE_SIZE;
                writeQueue = writeQueue.slice(-MAX_QUEUE_SIZE);
                log('warn', `Queue cleanup: removed ${removed} old operations`);
            }

            // Clean memory cache if too large
            if (memoryCache.size > 25) {
                const oldestKeys = Array.from(memoryCache.keys()).slice(0, 5);
                oldestKeys.forEach(key => {
                    memoryCache.delete(key);
                    memoryCacheExpiry.delete(key);
                });
                log('info', `Memory cache cleanup: removed ${oldestKeys.length} old entries`);
            }

            startPeriodicCleanup();
        }
    }, 20000);
};

export const shutdownCacheManager = () => {
    log('warn', 'Shutting down cache manager');
    isShuttingDown = true;

    if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
    }

    writeQueue = [];
    activeWrites = 0;
    isProcessing = false;

    memoryCache.clear();
    memoryCacheExpiry.clear();

    clearAllCaches();
};

startPeriodicCleanup();
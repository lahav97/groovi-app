import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { createLogger } from '../utils/Logger';
import AppMemoryManager from '../utils/AppMemoryManager';

const logger = createLogger('useVideoCache');

export const useVideoCache = (videos = []) => {
    const isFocused = useIsFocused();

    // Video states and refs
    const [videoStates, setVideoStates] = useState({});
    const [pausedStatus, setPausedStatus] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lastVideoListHash, setLastVideoListHash] = useState('');

    // Video refs cache - maintained across focus changes
    const videoRefs = useRef({});
    const videoCache = useRef(new Map());

    // Focus state tracking with initialization flag
    const wasUnfocused = useRef(false);
    const pausedByUnfocus = useRef(new Set());
    const isInitialized = useRef(false);

    // Generate hash of video list to detect actual changes
    const generateVideoListHash = useCallback((videoList) => {
        if (!videoList || videoList.length === 0) return '';
        return videoList.map(v => {
            const url = typeof v === 'string' ? v : (v?.url || v?.uri || v?.video_url || v?.videoUrl);
            return url?.substring(url.length - 20) || 'unknown';
        }).join('|');
    }, []);

    // Register with AppMemoryManager for cleanup coordination
    useEffect(() => {
        const cleanupListener = (cleanupType) => {
            if (cleanupType === 'emergency_cleanup') {
                logger.info('🚨 Emergency cleanup - clearing video cache');
                performEmergencyCleanup();
            } else if (cleanupType === 'routine_cleanup') {
                logger.debug('🧹 Routine cleanup - pausing videos');
                pauseAllVideos('routine_cleanup');
            }
        };

        AppMemoryManager.addNavigationListener(cleanupListener);

        return () => {
            AppMemoryManager.removeNavigationListener(cleanupListener);
        };
    }, []);

    // FIXED: Focus/unfocus handling with proper initialization
    useEffect(() => {
        // Wait for component to be fully initialized before handling focus changes
        if (!isInitialized.current) {
            if (isFocused) {
                isInitialized.current = true;
                logger.debug('📱 Video cache initialized with focus');
            }
            return;
        }

        if (isFocused) {
            if (wasUnfocused.current) {
                logger.info('📱 Screen focused - resuming videos');
                setTimeout(() => {
                    resumePausedByUnfocusVideos();
                }, 300); // Small delay to ensure smooth navigation
                wasUnfocused.current = false;
            }
        } else {
            logger.info('📱 Screen unfocused - pausing videos (no cache clear)');
            pauseAllVideosForUnfocus();
            wasUnfocused.current = true;
        }
    }, [isFocused]);

    /**
     * Generate unique video ID for consistent tracking
     */
    const generateVideoId = useCallback((videoUrl, index) => {
        if (!videoUrl || typeof videoUrl !== 'string') {
            logger.warn('⚠️ Invalid video URL provided', {
                videoUrl,
                index,
                type: typeof videoUrl
            });
            return `profile-video-${index}-invalid`;
        }

        const urlHash = videoUrl.split('/').pop() || videoUrl.substring(videoUrl.length - 10);
        const videoId = `profile-video-${index}-${urlHash}`;

        return videoId;
    }, []);

    /**
     * Set video loading state
     */
    const setVideoLoadingState = useCallback((videoId, state) => {
        setVideoStates(prev => {
            if (prev[videoId] === state) {
                return prev;
            }

            logger.debug('🎬 Video state updated', {
                videoId,
                previousState: prev[videoId],
                newState: state
            });

            return {
                ...prev,
                [videoId]: state
            };
        });
    }, []);

    /**
     * Check video states
     */
    const isVideoLoading = useCallback((videoId) => {
        return videoStates[videoId] === 'loading';
    }, [videoStates]);

    const isVideoLoaded = useCallback((videoId) => {
        return videoStates[videoId] === 'loaded';
    }, [videoStates]);

    const isVideoCached = useCallback((videoId) => {
        return videoCache.current.has(videoId);
    }, []);

    /**
     * Video event handlers
     */
    const handleVideoLoadStart = useCallback((videoId) => {
        logger.debug('🔄 Video load start', { videoId });
        setVideoLoadingState(videoId, 'loading');
    }, [setVideoLoadingState]);

    const handleVideoReadyForDisplay = useCallback((videoId, videoRef) => {
        logger.info('✅ Video ready for display', {
            videoId,
            hasRef: !!videoRef
        });

        setVideoLoadingState(videoId, 'loaded');

        // Cache the video ref
        if (videoRef) {
            videoCache.current.set(videoId, {
                ref: videoRef,
                cachedAt: Date.now(),
                loaded: true
            });
        }
    }, [setVideoLoadingState]);

    const handleVideoLoadError = useCallback((videoId, error) => {
        logger.error('❌ Video load error occurred', {
            videoId,
            error: error?.message || error
        });

        setVideoLoadingState(videoId, 'error');
    }, [setVideoLoadingState]);

    /**
     * Pause all videos for unfocus (no cache clearing)
     */
    const pauseAllVideosForUnfocus = useCallback(() => {
        const pausedIds = new Set();

        Object.entries(videoRefs.current).forEach(([videoId, ref]) => {
            if (ref && ref.pauseAsync && !pausedStatus[videoId]) {
                ref.pauseAsync().catch((error) => {
                    logger.warn('⚠️ Failed to pause video on unfocus', {
                        videoId,
                        error: error.message
                    });
                });
                pausedIds.add(videoId);
            }
        });

        pausedByUnfocus.current = pausedIds;

        logger.info('⏸️ Videos paused for unfocus', {
            pausedCount: pausedIds.size
        });
    }, [pausedStatus]);

    /**
     * Resume videos that were paused by unfocus
     */
    const resumePausedByUnfocusVideos = useCallback(() => {
        const resumedIds = [];

        pausedByUnfocus.current.forEach(videoId => {
            const ref = videoRefs.current[videoId];
            if (ref && ref.playAsync && !pausedStatus[videoId]) {
                // Only resume if on current index and not manually paused
                const videoIndex = Object.keys(videoRefs.current).indexOf(videoId);

                if (videoIndex === currentIndex) {
                    ref.playAsync().catch((error) => {
                        logger.warn('⚠️ Failed to resume video on focus', {
                            videoId,
                            error: error.message
                        });
                    });
                    resumedIds.push(videoId);
                }
            }
        });

        pausedByUnfocus.current.clear();

        logger.info('▶️ Videos resumed from unfocus', {
            resumedCount: resumedIds.length
        });
    }, [pausedStatus, currentIndex]);

    /**
     * Pause all videos for routine cleanup
     */
    const pauseAllVideos = useCallback((reason = 'cleanup') => {
        let pausedCount = 0;

        Object.values(videoRefs.current).forEach(ref => {
            if (ref && ref.pauseAsync) {
                ref.pauseAsync().catch(() => {}); // Silent fail
                pausedCount++;
            }
        });

        logger.info('⏸️ All videos paused', {
            reason,
            pausedCount
        });
    }, []);

    /**
     * Emergency cleanup - clear everything
     */
    const performEmergencyCleanup = useCallback(() => {
        logger.warn('🚨 Performing emergency video cleanup');

        let pausedCount = 0;
        const totalRefs = Object.keys(videoRefs.current).length;

        // Pause all videos
        Object.values(videoRefs.current).forEach(ref => {
            if (ref && ref.pauseAsync) {
                ref.pauseAsync().catch(() => {}); // Silent fail
                pausedCount++;
            }
        });

        // Clear all refs and cache
        videoRefs.current = {};
        videoCache.current.clear();
        setVideoStates({});
        setPausedStatus({});
        pausedByUnfocus.current.clear();
        setCurrentIndex(0);
        isInitialized.current = false;

        logger.info('✅ Emergency video cleanup completed', {
            pausedVideos: pausedCount,
            clearedRefs: totalRefs
        });
    }, []);

    /**
     * Process videos with list change detection
     */
    const videoObjects = useMemo(() => {
        if (!videos || !Array.isArray(videos) || videos.length === 0) {
            return [];
        }

        // Generate hash to detect actual list changes
        const currentHash = generateVideoListHash(videos);
        const hasListChanged = currentHash !== lastVideoListHash;

        if (hasListChanged) {
            logger.info('📝 Video list changed', {
                videoCount: videos.length
            });
            setLastVideoListHash(currentHash);
        }

        const processedVideos = videos
            .map((videoUrl, index) => {
                let finalVideoUrl = videoUrl;

                // Handle different video formats
                if (typeof videoUrl === 'object' && videoUrl !== null) {
                    finalVideoUrl = videoUrl.url || videoUrl.uri || videoUrl.video_url || videoUrl.videoUrl;
                }

                // Validate URL
                if (!finalVideoUrl || typeof finalVideoUrl !== 'string') {
                    logger.warn(`❌ Invalid video at index ${index}`);
                    return null;
                }

                if (!finalVideoUrl.startsWith('http')) {
                    logger.warn(`❌ Invalid video URL format at index ${index}`);
                    return null;
                }

                const videoId = generateVideoId(finalVideoUrl, index);

                return {
                    id: videoId,
                    uri: finalVideoUrl,
                    index,
                    isCached: isVideoCached(videoId),
                    isLoading: isVideoLoading(videoId),
                    isLoaded: isVideoLoaded(videoId),
                    listChanged: hasListChanged
                };
            })
            .filter(video => video !== null);

        return processedVideos;
    }, [videos, generateVideoListHash, lastVideoListHash, isVideoCached, isVideoLoading, isVideoLoaded, generateVideoId]);

    /**
     * Toggle video pause/play
     */
    const togglePause = useCallback((id) => {
        setPausedStatus(prev => {
            const newPausedState = !prev[id];
            return { ...prev, [id]: newPausedState };
        });
    }, []);

    /**
     * FIXED: Determine if video should play with proper initialization check
     */
    const shouldVideoPlay = useCallback((videoId, index) => {
        const isCurrentVideo = index === currentIndex;
        const isPaused = pausedStatus[videoId];
        const isLoading = videoStates[videoId] === 'loading';

        // Don't play until properly initialized and focused
        const shouldPlay = isInitialized.current &&
            isFocused &&
            isCurrentVideo &&
            !isPaused &&
            !isLoading;

        return shouldPlay;
    }, [isFocused, currentIndex, pausedStatus, videoStates]);

    /**
     * Handle video swiper index change
     */
    const onIndexChanged = useCallback((index, videos) => {
        logger.info('📱 Video index changed', {
            previousIndex: currentIndex,
            newIndex: index
        });

        setCurrentIndex(index);

        if (!videos || videos.length === 0) return;

        // Pause all videos except current one
        videos.forEach((video, videoIndex) => {
            const videoRef = videoRefs.current[video.id];

            if (video.id !== videos[index]?.id && videoRef?.pauseAsync) {
                videoRef.pauseAsync().catch(() => {}); // Silent fail
            }
        });

        // Play current video if conditions are met
        const currentVideo = videos[index];
        if (currentVideo && shouldVideoPlay(currentVideo.id, index)) {
            const currentVideoRef = videoRefs.current[currentVideo.id];
            if (currentVideoRef?.playAsync) {
                // Small delay to ensure smooth transition
                setTimeout(() => {
                    currentVideoRef.playAsync().catch(() => {}); // Silent fail
                }, 100);
            }
        }
    }, [currentIndex, shouldVideoPlay]);

    /**
     * Set video ref in cache
     */
    const setVideoRef = useCallback((videoId, ref) => {
        videoRefs.current[videoId] = ref;

        // Cache video ref when ready
        if (ref && !isVideoCached(videoId)) {
            handleVideoReadyForDisplay(videoId, ref);
        }
    }, [isVideoCached, handleVideoReadyForDisplay]);

    /**
     * Get video ref from cache
     */
    const getVideoRef = useCallback((videoId) => {
        return videoRefs.current[videoId];
    }, []);

    /**
     * Preload videos only when list actually changed
     */
    const preloadVideos = useCallback((startIndex = 0, count = 2) => {
        const hasListChanged = videoObjects.some(v => v.listChanged);

        if (!hasListChanged && videoObjects.some(v => v.isCached)) {
            return;
        }

        for (let i = startIndex; i < Math.min(startIndex + count, videoObjects.length); i++) {
            const video = videoObjects[i];
            if (video && !video.isCached && !video.isLoading) {
                setVideoLoadingState(video.id, 'preloading');
            }
        }
    }, [videoObjects, setVideoLoadingState]);

    // Auto-preload when video objects change and list actually changed
    useEffect(() => {
        if (videoObjects.length > 0) {
            const hasListChanged = videoObjects.some(v => v.listChanged);
            if (hasListChanged) {
                preloadVideos(0, 2);
            }
        }
    }, [videoObjects, preloadVideos]);

    return {
        // Video objects for rendering
        videoObjects,

        // State management
        videoStates,
        currentIndex,

        // Control functions
        onIndexChanged,
        togglePause,
        shouldVideoPlay,

        // Video event handlers
        handleVideoLoadStart,
        handleVideoReadyForDisplay,
        handleVideoLoadError,

        // Reference management
        setVideoRef,
        getVideoRef,

        // Cache utilities (legacy compatibility)
        clearVideoCache: performEmergencyCleanup,
        preloadVideos,
        isVideoCached,
        isVideoLoading,
        isVideoLoaded,

        // Focus state
        isFocused,
        pauseAllVideos
    };
};

export const clearVideoCache = () => {
    AppMemoryManager.requestCleanup('legacy_clear_video_cache', 'emergency');
};

export default useVideoCache;
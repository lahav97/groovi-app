/**
 * @module useVideoCache
 * ENHANCED: Better profile video handling and loading state management
 * Handles tiny loading spinners and smart video caching for smooth playback
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useIsFocused } from '@react-navigation/native';

/**
 * Custom hook for video caching and loading state management
 * @param {Array} videos - Array of video URLs from profile
 * @returns {Object} Video cache utilities and state management
 */
export const useVideoCache = (videos = []) => {
  const isFocused = useIsFocused();
  
  // VIDEO CACHING & LOADING STATES
  const [videoStates, setVideoStates] = useState({}); // Track loading state per video
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // VIDEO REFS CACHE - Keep loaded videos in memory
  const videoRefs = useRef({}); // Cache video refs to prevent re-loading
  const videoCache = useRef(new Map()); // Simple memory cache for video states

  // Debug video input
  useEffect(() => {
    console.log('🎬 useVideoCache: Received videos:', {
      type: typeof videos,
      isArray: Array.isArray(videos),
      length: videos?.length || 0,
      first: videos?.[0],
      data: videos
    });
  }, [videos]);

  /**
   * Generate unique video ID for consistent caching
   */
  const generateVideoId = useCallback((videoUrl, index) => {
    if (!videoUrl || typeof videoUrl !== 'string') {
      console.warn('⚠️ Invalid video URL:', videoUrl);
      return `profile-video-${index}-invalid`;
    }
    
    const urlHash = videoUrl.split('/').pop() || videoUrl.substring(videoUrl.length - 10);
    return `profile-video-${index}-${urlHash}`;
  }, []);

  /**
   * Set video loading state with tiny spinner
   */
  const setVideoLoadingState = useCallback((videoId, state) => {
    setVideoStates(prev => {
      // Prevent unnecessary state updates
      if (prev[videoId] === state) return prev;
      return {
        ...prev,
        [videoId]: state
      };
    });
  }, []);

  /**
   * Check if video is currently loading (for spinner display)
   */
  const isVideoLoading = useCallback((videoId) => {
    return videoStates[videoId] === 'loading';
  }, [videoStates]);

  /**
   * Check if video is loaded and cached
   */
  const isVideoLoaded = useCallback((videoId) => {
    return videoStates[videoId] === 'loaded';
  }, [videoStates]);

  /**
   * Handle video load start - show tiny spinner
   */
  const handleVideoLoadStart = useCallback((videoId) => {
    console.log('🔄 Video load start:', videoId);
    setVideoLoadingState(videoId, 'loading');
  }, [setVideoLoadingState]);

  /**
   * Handle video ready for display - hide spinner, cache ref
   */
  const handleVideoReadyForDisplay = useCallback((videoId, videoRef) => {
    console.log('✅ Video ready for display:', videoId);
    setVideoLoadingState(videoId, 'loaded');
    
    // CACHE the video ref to prevent re-loading when swiping back
    if (videoRef) {
      videoCache.current.set(videoId, {
        ref: videoRef,
        cachedAt: Date.now(),
        loaded: true
      });
    }
  }, [setVideoLoadingState]);

  /**
   * Handle video load error - show error state
   */
  const handleVideoLoadError = useCallback((videoId, error) => {
    console.error(`❌ useVideoCache: Video load error: ${videoId}`, error);
    setVideoLoadingState(videoId, 'error');
  }, [setVideoLoadingState]);

  /**
   * Check if video is cached (already loaded before)
   */
  const isVideoCached = useCallback((videoId) => {
    return videoCache.current.has(videoId);
  }, []);

  /**
   * ENHANCED: Convert profile videos to video objects with better validation
   */
  const videoObjects = useMemo(() => {
    console.log('🔄 Processing videos for videoObjects...');
    
    // Handle various video input formats
    if (!videos) {
      console.log('📝 No videos provided (null/undefined)');
      return [];
    }

    if (!Array.isArray(videos)) {
      console.warn('⚠️ Videos is not an array:', typeof videos, videos);
      return [];
    }

    if (videos.length === 0) {
      console.log('📝 Videos array is empty');
      return [];
    }

    const processedVideos = videos
      .map((videoUrl, index) => {
        // Handle different video formats
        let finalVideoUrl = videoUrl;
        
        // If video is an object, extract URL
        if (typeof videoUrl === 'object' && videoUrl !== null) {
          finalVideoUrl = videoUrl.url || videoUrl.uri || videoUrl.video_url || videoUrl.videoUrl;
        }
        
        // Validate URL
        if (!finalVideoUrl || typeof finalVideoUrl !== 'string') {
          console.warn(`⚠️ Invalid video at index ${index}:`, videoUrl);
          return null;
        }
        
        // Basic URL validation
        if (!finalVideoUrl.startsWith('http')) {
          console.warn(`⚠️ Invalid video URL format at index ${index}:`, finalVideoUrl);
          return null;
        }

        const videoId = generateVideoId(finalVideoUrl, index);
        
        return {
          id: videoId,
          uri: finalVideoUrl,
          index,
          isCached: isVideoCached(videoId),
          isLoading: isVideoLoading(videoId),
          isLoaded: isVideoLoaded(videoId)
        };
      })
      .filter(video => video !== null); // Remove invalid videos

    console.log('✅ Processed video objects:', {
      input: videos.length,
      output: processedVideos.length,
      videos: processedVideos.map(v => ({ id: v.id, uri: v.uri?.substring(0, 50) + '...' }))
    });

    return processedVideos;
  }, [videos, generateVideoId, isVideoCached, isVideoLoading, isVideoLoaded]);

  /**
   * Toggle video pause/play
   */
  const togglePause = useCallback((id) => {
    console.log('⏯️ Toggling pause for video:', id);
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Check if video should play (based on focus, index, and pause status)
   */
  const shouldVideoPlay = useCallback((videoId, index) => {
    const isCurrentVideo = index === currentIndex;
    const isPaused = pausedStatus[videoId];
    const shouldPlay = isFocused && isCurrentVideo && !isPaused;
    
    return shouldPlay;
  }, [isFocused, currentIndex, pausedStatus]);

  /**
   * Handle video swiper index change with smart caching
   */
  const onIndexChanged = useCallback((index, videos) => {
    console.log('📱 Video index changed to:', index);
    setCurrentIndex(index);
    
    if (!videos || videos.length === 0) return;
    
    // Pause all videos except current one
    videos.forEach(video => {
      if (video.id !== videos[index]?.id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync().catch(() => {});
      }
    });
    
    // Play current video if not paused and loaded
    const currentVideo = videos[index];
    if (currentVideo && !pausedStatus[currentVideo.id] && videoRefs.current[currentVideo.id]?.playAsync) {
      videoRefs.current[currentVideo.id].playAsync().catch(() => {});
    }

    // PRELOAD next video in background (for smooth swiping)
    const nextIndex = index + 1;
    if (nextIndex < videos.length) {
      const nextVideo = videos[nextIndex];
      if (nextVideo && !nextVideo.isCached && !nextVideo.isLoading) {
        // Trigger preload
        console.log('🔄 Preloading next video:', nextVideo.id);
      }
    }
  }, [pausedStatus]);

  /**
   * Set video ref in cache
   */
  const setVideoRef = useCallback((videoId, ref) => {
    console.log('📝 Setting video ref for:', videoId);
    videoRefs.current[videoId] = ref;
    
    // CACHE VIDEO REF when it's ready
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
   * Clear all video cache (for logout, etc.)
   */
  const clearVideoCache = useCallback(() => {
    console.log('🧹 Clearing video cache...');
    
    // Pause all videos
    Object.values(videoRefs.current).forEach(ref => {
      if (ref && ref.pauseAsync) {
        ref.pauseAsync().catch(() => {});
      }
    });
    
    // Clear all refs and cache
    videoRefs.current = {};
    videoCache.current.clear();
    setVideoStates({});
    setPausedStatus({});
    setCurrentIndex(0);
  }, []);

  /**
   * Preload videos for better performance
   */
  const preloadVideos = useCallback((startIndex = 0, count = 2) => {
    console.log(`🔄 Preloading ${count} videos starting from index ${startIndex}`);
    
    for (let i = startIndex; i < Math.min(startIndex + count, videoObjects.length); i++) {
      const video = videoObjects[i];
      if (video && !video.isCached && !video.isLoading) {
        // Trigger video preload
        setVideoLoadingState(video.id, 'preloading');
      }
    }
  }, [videoObjects, setVideoLoadingState]);

  // Preload first few videos when component mounts
  useEffect(() => {
    if (videoObjects.length > 0) {
      console.log('🚀 Auto-preloading first videos...');
      preloadVideos(0, 2);
    }
  }, [videoObjects.length > 0]);

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
    
    // Cache utilities
    clearVideoCache,
    preloadVideos,
    isVideoCached,
    isVideoLoading,
    isVideoLoaded,
  };
};

/**
 * Standalone video cache clearing function for memory management
 * Can be called from AppNavigator or other components for emergency cleanup
 */
export const clearVideoCache = () => {
  console.log('🧹 Global video cache clear triggered');
  
  try {
    // Try to clear any global video references if they exist
    if (global.videoCache) {
      global.videoCache.clear();
    }
    
    // Clear any global video refs
    if (global.videoRefs) {
      Object.values(global.videoRefs).forEach(ref => {
        if (ref && ref.pauseAsync) {
          ref.pauseAsync().catch(() => {});
        }
      });
      global.videoRefs = {};
    }
    
    console.log('✅ Global video cache cleared');
  } catch (error) {
    console.warn('⚠️ Error clearing global video cache:', error);
  }
  
  // Force garbage collection if available
  if (global.gc) {
    setTimeout(() => {
      global.gc();
      console.log('♻️ Forced GC after video cache clear');
    }, 100);
  }
};

export default useVideoCache;
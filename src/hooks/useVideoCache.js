/**
 * @module useVideoCache
 * Custom hook for video caching and loading state management
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

  /**
   * Generate unique video ID for consistent caching
   */
  const generateVideoId = useCallback((videoUrl, index) => {
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
    setVideoLoadingState(videoId, 'loading');
  }, [setVideoLoadingState]);

  /**
   * Handle video ready for display - hide spinner, cache ref
   */
  const handleVideoReadyForDisplay = useCallback((videoId, videoRef) => {
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
   * Convert profile videos (array of URL strings) to video objects with caching info
   */
  const videoObjects = useMemo(() => {
    if (!videos || !Array.isArray(videos)) {
      return [];
    }

    return videos.map((videoUrl, index) => {
      const videoId = generateVideoId(videoUrl, index);
      return {
        id: videoId,
        uri: videoUrl,
        index,
        isCached: isVideoCached(videoId),
        isLoading: isVideoLoading(videoId),
        isLoaded: isVideoLoaded(videoId)
      };
    });
  }, [videos, generateVideoId, isVideoCached, isVideoLoading, isVideoLoaded]);

  /**
   * Toggle video pause/play
   */
  const togglePause = useCallback((id) => {
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Handle video swiper index change with smart caching
   */
  const onIndexChanged = useCallback((index) => {
    setCurrentIndex(index);
    
    // Pause all videos except current one
    videoObjects.forEach(video => {
      if (video.id !== videoObjects[index].id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync();
      }
    });
    
    // Play current video if not paused and loaded
    if (!pausedStatus[videoObjects[index].id] && videoRefs.current[videoObjects[index].id]?.playAsync) {
      videoRefs.current[videoObjects[index].id].playAsync();
    }

    // PRELOAD next video in background (for smooth swiping)
    const nextIndex = index + 1;
    if (nextIndex < videoObjects.length) {
      const nextVideo = videoObjects[nextIndex];
      if (!nextVideo.isCached && !nextVideo.isLoading) {
      }
    }
  }, [videoObjects, pausedStatus]);

  /**
   * Set video ref in cache
   */
  const setVideoRef = useCallback((videoId, ref) => {
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
   * Check if video should play
   */
  const shouldVideoPlay = useCallback((videoId, index) => {
    const video = videoObjects.find(v => v.id === videoId);
    
    return (
      !pausedStatus[videoId] && 
      isFocused && 
      currentIndex === index &&
      !video?.isLoading
    );
  }, [videoObjects, pausedStatus, isFocused, currentIndex]);

  /**
   * Clear video cache
   */
  const clearVideoCache = useCallback(() => {
    // Pause all videos first
    Object.values(videoRefs.current).forEach(ref => {
      if (ref?.pauseAsync) {
        ref.pauseAsync();
      }
    });
    
    // Clear all caches and states
    videoCache.current.clear();
    setVideoStates({});
    setPausedStatus({});
    setCurrentIndex(0);
    videoRefs.current = {};
  }, []);

  // Pause videos when screen loses focus
  useEffect(() => {
    if (!isFocused) {
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    }
  }, [isFocused]);

  return {
    // Video objects with cache info (MEMOIZED)
    videoObjects,
    
    // State
    videoStates,
    pausedStatus,
    currentIndex,
    
    // Video state checkers
    isVideoLoading,
    isVideoLoaded,
    isVideoCached,
    
    // Event handlers
    handleVideoLoadStart,
    handleVideoReadyForDisplay,
    handleVideoLoadError,
    
    // Video controls
    togglePause,
    onIndexChanged,
    shouldVideoPlay,
    
    // Video ref management
    setVideoRef,
    getVideoRef,
    
    // Utilities
    generateVideoId,
    clearVideoCache,
  };
};
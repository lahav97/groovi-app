import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  useColorScheme,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { Video } from 'expo-av';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import VideoInfo from './VideoInfo';
import * as FileSystem from 'expo-file-system';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// IMPROVED VIDEO MANAGER - Single source of truth
class GlobalVideoManager {
  constructor() {
    this.currentActiveVideo = null;
    this.allVideoRefs = new Map(); // Use Map for better tracking
    this.pendingOperations = new Set(); // Track pending operations
  }

  registerVideo(videoRef, videoId) {
    this.allVideoRefs.set(videoId, videoRef);
  }

  unregisterVideo(videoId) {
    this.allVideoRefs.delete(videoId);
    this.pendingOperations.delete(videoId);
  }

  // FIXED: Prevent race conditions with operation tracking
  async setActiveVideo(videoRef, videoId) {
    // Prevent multiple simultaneous operations
    if (this.pendingOperations.has(videoId)) {
      return;
    }

    this.pendingOperations.add(videoId);

    try {
      // Only pause videos that aren't the new active one
      for (const [id, ref] of this.allVideoRefs) {
        if (id !== videoId && ref.current) {
          try {
            await ref.current.pauseAsync();
          } catch (error) {
            // Silent fail
          }
        }
      }

      this.currentActiveVideo = videoId;
      
      // Start the new video only if ref is still valid
      if (videoRef.current && this.allVideoRefs.has(videoId)) {
        try {
          await videoRef.current.playAsync();
        } catch (error) {
          console.warn('Failed to play video:', error);
        }
      }
    } finally {
      this.pendingOperations.delete(videoId);
    }
  }

  async pauseAllVideos() {
    const pausePromises = [];
    
    for (const [id, ref] of this.allVideoRefs) {
      if (ref.current) {
        pausePromises.push(
          ref.current.pauseAsync().catch(() => {})
        );
      }
    }
    
    await Promise.all(pausePromises);
    this.currentActiveVideo = null;
  }

  isActive(videoId) {
    return this.currentActiveVideo === videoId;
  }
}

const globalVideoManager = new GlobalVideoManager();

// Background cache queue - unchanged
const cacheQueue = [];
let isProcessingCacheQueue = false;

const processCacheQueue = async () => {
  if (isProcessingCacheQueue || cacheQueue.length === 0) return;
  
  isProcessingCacheQueue = true;
  
  while (cacheQueue.length > 0) {
    const cacheOperation = cacheQueue.shift();
    try {
      await cacheOperation();
    } catch (error) {
      // Silent fail
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  isProcessingCacheQueue = false;
};

// FIXED: Ultra-stable VideoItem with controlled playback
const VideoItem = memo(({ item, isVisible, height, shouldCache = false }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  
  // FIXED: Simplified state management
  const [userPaused, setUserPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // FIXED: Stable refs
  const retryCountRef = useRef(0);
  const componentMountedRef = useRef(true);
  const cacheAttemptedRef = useRef(false);
  const lastPlayStateRef = useRef(false);
  const stableVideoSourceRef = useRef(null);
  
  const videoId = useRef(`video-${item.id || 'unknown'}-${Date.now()}`).current;
  
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  // FIXED: Stable video source - prevents restarts from source changes
  const videoSource = stableVideoSourceRef.current || localVideoUri || item.videoUrl;
  
  // Initialize stable source
  useEffect(() => {
    if (!stableVideoSourceRef.current) {
      stableVideoSourceRef.current = item.videoUrl;
    }
  }, [item.videoUrl]);

  // Register with global video manager
  useEffect(() => {
    globalVideoManager.registerVideo(videoRef, videoId);
    return () => {
      globalVideoManager.unregisterVideo(videoId);
    };
  }, [videoId]);

  // FIXED: Single playback control logic - prevents conflicts
  const updatePlaybackState = useCallback(async () => {
    if (!componentMountedRef.current || !videoLoaded) return;

    const shouldPlay = isVisible && isFocused && !userPaused;
    const isCurrentlyActive = globalVideoManager.isActive(videoId);

    // Only change state if needed - prevents unnecessary operations
    if (shouldPlay === lastPlayStateRef.current) {
      return;
    }

    lastPlayStateRef.current = shouldPlay;

    if (shouldPlay && !isCurrentlyActive) {
      // Need to start playing
      await globalVideoManager.setActiveVideo(videoRef, videoId);
    } else if (!shouldPlay && isCurrentlyActive) {
      // Need to stop playing
      if (videoRef.current) {
        try {
          await videoRef.current.pauseAsync();
        } catch (error) {
          // Silent fail
        }
      }
    }
  }, [isVisible, isFocused, userPaused, videoLoaded, videoId]);

  // FIXED: Debounced playback state updates - prevents rapid changes
  useEffect(() => {
    const timeoutId = setTimeout(updatePlaybackState, 100);
    return () => clearTimeout(timeoutId);
  }, [updatePlaybackState]);

  // Screen focus handling
  useEffect(() => {
    if (!isFocused) {
      globalVideoManager.pauseAllVideos();
    }
  }, [isFocused]);

  // Background caching - unchanged but using stable source
  const cacheVideoInBackground = async (videoUrl) => {
    if (!shouldCache || cacheAttemptedRef.current || !componentMountedRef.current) return;
    cacheAttemptedRef.current = true;
    
    const cacheOperation = async () => {
      try {
        if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
          return null;
        }

        const filename = videoUrl.split('/').pop() || `video_${Date.now()}.mp4`;
        const localUri = `${FileSystem.cacheDirectory}videos/${filename}`;
        
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
        }

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists && componentMountedRef.current) {
          // FIXED: Update local URI without changing stable source during playback
          setLocalVideoUri(localUri);
          return localUri;
        }
        
        if (shouldCache && isVisible) {
          const downloadResult = await FileSystem.downloadAsync(videoUrl, localUri);
          
          if (downloadResult.status === 200 && componentMountedRef.current) {
            setLocalVideoUri(localUri);
            return localUri;
          }
        }
        
        return null;
      } catch (error) {
        return null;
      }
    };
    
    cacheQueue.push(cacheOperation);
    setTimeout(processCacheQueue, 0);
  };

  // Cache trigger
  useEffect(() => {
    if (item.videoUrl && shouldCache && isVisible && componentMountedRef.current) {
      cacheVideoInBackground(item.videoUrl);
    }
  }, [item.videoUrl, shouldCache, isVisible]);

  // Play icon timeout
  useEffect(() => {
    if (showPlayIcon) {
      const timeout = setTimeout(() => setShowPlayIcon(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [showPlayIcon]);

  // Loading timeout
  useEffect(() => {
    if (isLoading && isPlaying) {
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isPlaying]);

  // Clear error when playing
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  // FIXED: User pause/play toggle without state conflicts
  const handleTogglePlayback = useCallback(() => {
    if (!componentMountedRef.current || !videoLoaded) return;
    
    const newUserPaused = !userPaused;
    setUserPaused(newUserPaused);
    setShowPlayIcon(true);
    
    // Update will be handled by updatePlaybackState
  }, [userPaused, videoLoaded]);

  // FIXED: Video load handler - ensures stable loaded state
  const handleVideoLoad = useCallback(() => {
    if (!componentMountedRef.current) return;
    
    setVideoLoaded(true);
    setIsLoading(false);
    setHasError(false);
    retryCountRef.current = 0;
    
    // Trigger playback state update after load
    setTimeout(updatePlaybackState, 50);
  }, [updatePlaybackState]);

  // FIXED: Better error handling without source switching during playback
  const handleVideoError = useCallback((error) => {
    if (!componentMountedRef.current) return;
    
    console.warn('Video error:', error);
    
    const errorString = error?.toString() || '';
    
    // Handle corrupted cache - but don't switch source if playing
    if (localVideoUri && (errorString.includes('j7.x$b') || errorString.includes('could read'))) {
      if (!isPlaying) {
        setLocalVideoUri(null);
        cacheAttemptedRef.current = false;
        stableVideoSourceRef.current = item.videoUrl;
      }
    }
    
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    setVideoLoaded(false);
    
    // Reduced retry attempts to prevent restart loops
    if (retryCountRef.current < 1) {
      retryCountRef.current += 1;
      setTimeout(() => {
        if (componentMountedRef.current) {
          retryLoadVideo();
        }
      }, 1000);
    }
  }, [localVideoUri, isPlaying, item.videoUrl]);

  // FIXED: Stable playback status handler
  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (!componentMountedRef.current) return;
    
    if (status.isLoaded) {
      const newIsPlaying = status.isPlaying && !status.isPaused;
      setIsPlaying(newIsPlaying);
      
      if (newIsPlaying) {
        setIsLoading(false);
        setHasError(false);
      }
      
      // Auto-replay when finished - but check if still should be playing
      if (status.didJustFinish && !status.isLooping && videoRef.current) {
        const shouldStillPlay = isVisible && isFocused && !userPaused;
        if (shouldStillPlay) {
          videoRef.current.replayAsync();
        }
      }
    }
  }, [isVisible, isFocused, userPaused]);

  const retryLoadVideo = useCallback(async () => {
    if (!componentMountedRef.current || !item.videoUrl) return;
    
    try {
      if (videoRef.current) {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ uri: stableVideoSourceRef.current }, {}, false);
      }
    } catch (e) {
      setHasError(true);
      setIsLoading(false);
    }
  }, [item.videoUrl]);

  // Component cleanup
  useEffect(() => {
    componentMountedRef.current = true;
    
    return () => {
      componentMountedRef.current = false;
      
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [videoId]);

  // Validate video URL
  if (!item.videoUrl || typeof item.videoUrl !== 'string' || !item.videoUrl.startsWith('http')) {
    return (
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <View style={styles.centerOverlay}>
          <Icon name="videocam-off" size={60} color="#666" />
          <Text style={styles.errorText}>Invalid video</Text>
        </View>
        <VideoInfo video={{ username: item.user, description: item.description }} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <Video
          ref={videoRef}
          source={{ uri: videoSource }}
          style={styles.videoPlayer}
          resizeMode="cover"
          // FIXED: Remove shouldPlay prop - use manual control only
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={500}
          rate={1.0}
          volume={1.0}
          // FIXED: Optimized buffer config for stability
          bufferConfig={{
            minBufferMs: 2000,
            maxBufferMs: 10000,
            bufferForPlaybackMs: 500,
            bufferForPlaybackAfterRebufferMs: 1000
          }}
          useNativeControls={false}
          ignoreSilentSwitch="ignore"
        />

        {/* Play/pause icon */}
        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <View style={styles.playIconBackground}>
              <Icon
                name={userPaused ? 'play' : 'pause'}
                size={50}
                color="white"
                style={styles.playIcon}
              />
            </View>
          </View>
        )}

        {/* Loading indicator */}
        {isLoading && !isPlaying && !showPlayIcon && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Error with retry */}
        {hasError && retryCountRef.current >= 1 && (
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            retryCountRef.current = 0;
            setLocalVideoUri(null);
            cacheAttemptedRef.current = false;
            stableVideoSourceRef.current = item.videoUrl;
            setHasError(false);
            setIsLoading(true);
            retryLoadVideo();
          }}>
            <Icon name="refresh" size={20} color="white" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        <VideoInfo video={{ username: item.user, description: item.description }} />
      </View>
    </TouchableWithoutFeedback>
  );
});

VideoItem.displayName = 'VideoItem';

const styles = StyleSheet.create({
  videoContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoPlayer: {
    width: width,
    height: SCREEN_HEIGHT,
  },
  centerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    zIndex: 10,
    alignItems: 'center',
  },
  playIconBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    alignSelf: 'center',
  },
  retryButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    top: '50%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});

export default VideoItem;
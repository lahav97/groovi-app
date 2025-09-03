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
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../styles/theme';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { createLogger } from '../../utils/Logger';

const logger = createLogger('VideoItem');
const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global Video Manager to handle play/pause across the app
class GlobalVideoManager {
  constructor() {
    this.currentActiveVideo = null;
    this.allVideoRefs = new Map();
    this.pausedVideos = new Set(); // Track manually paused videos
  }

  registerVideo(videoRef, videoId) {
    this.allVideoRefs.set(videoId, videoRef);
  }

  unregisterVideo(videoId) {
    this.allVideoRefs.delete(videoId);
    this.pausedVideos.delete(videoId);
  }

  // FIXED: Better handling of manual pause/play
  async setActiveVideo(videoRef, videoId, isManualPlay = false) {
    try {
      // If this video was manually paused, remove it from paused set
      if (isManualPlay) {
        this.pausedVideos.delete(videoId);
      }

      // Pause all other videos
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

      // Start the new video
      if (videoRef.current) {
        try {
          await videoRef.current.playAsync();
          logger.info(`▶️ Video playing: ${videoId}`);
        } catch (error) {
          logger.warn('⚠️ Failed to play video:', error);
        }
      }
    } catch (error) {
      logger.error('❌ Error setting active video:', error);
    }
  }

  async pauseVideo(videoId) {
    try {
      const ref = this.allVideoRefs.get(videoId);
      if (ref && ref.current) {
        await ref.current.pauseAsync();
        this.pausedVideos.add(videoId); // Mark as manually paused
        if (this.currentActiveVideo === videoId) {
          this.currentActiveVideo = null;
        }
        logger.info(`⏸️ Video paused: ${videoId}`);
      }
    } catch (error) {
      logger.error('❌ Error pausing video:', error);
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

  isManuallyPaused(videoId) {
    return this.pausedVideos.has(videoId);
  }
}

const globalVideoManager = new GlobalVideoManager();


// Cache processing for downloaded videos
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
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  isProcessingCacheQueue = false;
};

// ENHANCED VideoItem with Profile Picture and Better User Info Display
const VideoItem = memo(({ item, isVisible, height, shouldCache = false }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const navigation = useNavigation();

  // Video state management
  const [userPaused, setUserPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Refs
  const retryCountRef = useRef(0);
  const componentMountedRef = useRef(true);
  const cacheAttemptedRef = useRef(false);
  const stableVideoSourceRef = useRef(null);

  const videoId = useRef(`video-${item.id || 'unknown'}-${Date.now()}`).current;

  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  // Stable video source
  const videoSource = stableVideoSourceRef.current || localVideoUri || item.videoUrl;

  // Helper functions for user info
  const getUserDisplayName = useCallback(() => {
    return item.user || item.username || 'Unknown User';
  }, [item.user, item.username]);

  const getInstrumentsText = useCallback(() => {
    if (Array.isArray(item.instruments)) {
      return item.instruments.join(', ');
    }
    return item.description || item.instruments || 'Music Video';
  }, [item.instruments, item.description]);

  const getUserInitials = useCallback(() => {
    const name = getUserDisplayName();
    if (name === 'Unknown User') return 'U';

    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }, [getUserDisplayName]);

  const handleUserPress = useCallback(() => {
    try {
      const username = getUserDisplayName();
      logger.info('👤 User profile pressed', { username });

      if (!username || username === 'Unknown User') {
        logger.warn('No valid username available for profile navigation');
        return;
      }

      // Navigate to MusicianProfileScreen with username and any additional user data
      navigation.navigate('MusicianProfile', {
        username: username,
        ...(item.user_id && { userId: item.user_id }),
        ...(item.id && { videoId: item.id })
      });
    } catch (error) {
      logger.error('Failed to navigate to musician profile', {
        error: error.message,
        username: getUserDisplayName()
      });
    }
  }, [getUserDisplayName, navigation, item.user_id, item.id]);

  // Register video with global manager
  useEffect(() => {
    globalVideoManager.registerVideo(videoRef, videoId);
    return () => {
      globalVideoManager.unregisterVideo(videoId);
    };
  }, [videoId]);

  // Update playback state based on visibility and focus
  const updatePlaybackState = useCallback(async () => {
    if (!componentMountedRef.current || !videoLoaded) return;

    const shouldPlay = isVisible && isFocused && !userPaused;
    const isCurrentlyActive = globalVideoManager.isActive(videoId);

    if (shouldPlay && !isCurrentlyActive) {
      await globalVideoManager.setActiveVideo(videoRef, videoId, false);
    } else if (!shouldPlay && isCurrentlyActive) {
      if (videoRef.current) {
        try {
          await videoRef.current.pauseAsync();
        } catch (error) {
          // Silent fail
        }
      }
    }
  }, [isVisible, isFocused, userPaused, videoLoaded, videoId]);

  useEffect(() => {
    const timeoutId = setTimeout(updatePlaybackState, 100);
    return () => clearTimeout(timeoutId);
  }, [updatePlaybackState]);

  useEffect(() => {
    if (!isFocused) {
      globalVideoManager.pauseAllVideos();
    }
  }, [isFocused]);

  // Caching logic for video files
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

  useEffect(() => {
    if (item.videoUrl && shouldCache && isVisible && componentMountedRef.current) {
      cacheVideoInBackground(item.videoUrl);
    }
  }, [item.videoUrl, shouldCache, isVisible]);

  // Handle play/pause toggle
  const handleTogglePlayback = useCallback(async () => {
    if (!componentMountedRef.current || !videoLoaded) return;

    const newUserPaused = !userPaused;
    setUserPaused(newUserPaused);
    setShowPlayIcon(true);

    if (newUserPaused) {
      await globalVideoManager.pauseVideo(videoId);
    } else {
      await globalVideoManager.setActiveVideo(videoRef, videoId, true);
    }
  }, [userPaused, videoLoaded, videoId]);

  // Handle video load event
  const handleVideoLoad = useCallback(() => {
    if (!componentMountedRef.current) return;

    setVideoLoaded(true);
    setIsLoading(false);
    setHasError(false);
    retryCountRef.current = 0;

    setTimeout(updatePlaybackState, 50);
  }, [updatePlaybackState]);

  // Handle video error event
  const handleVideoError = useCallback((error) => {
    if (!componentMountedRef.current) return;

    const errorString = error?.toString() || '';

    // Don't log error if it's just a cache file issue - handle it silently
    if (localVideoUri && (
      errorString.includes('j7.x$b') ||
      errorString.includes('could read') ||
      errorString.includes('FileNotFoundException') ||
      errorString.includes('ENOENT') ||
      errorString.includes('No such file or directory')
    )) {
      logger.warn('⚠️ Cached video file not found, falling back to original URL');

      // Clear the corrupted cache and reset to original source
      setLocalVideoUri(null);
      cacheAttemptedRef.current = false;
      stableVideoSourceRef.current = item.videoUrl;

      // Try to reload with original URL silently
      if (videoRef.current) {
        videoRef.current.unloadAsync().then(() => {
          if (componentMountedRef.current) {
            videoRef.current.loadAsync({ uri: item.videoUrl }, {}, false);
          }
        }).catch(() => {
          // Only set error if we can't recover
          if (componentMountedRef.current) {
            setHasError(true);
            setIsLoading(false);
            setIsPlaying(false);
            setVideoLoaded(false);
          }
        });
      }
      return; // Don't proceed to error handling
    }

    // Only log actual errors, not cache fallbacks
    logger.error('❌ Video playback error:', {
      error: errorString.substring(0, 100),
      hasLocalCache: !!localVideoUri,
      videoId: videoId
    });

    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    setVideoLoaded(false);

    if (retryCountRef.current < 1) {
      retryCountRef.current += 1;
      setTimeout(() => {
        if (componentMountedRef.current) {
          retryLoadVideo();
        }
      }, 1000);
    }
  }, [localVideoUri, item.videoUrl, videoId]);

  // Handle playback status updates from the video
  const handlePlaybackStatusUpdate = useCallback((status) => {
    if (!componentMountedRef.current) return;

    if (status.isLoaded) {
      const newIsPlaying = status.isPlaying && !status.isPaused;
      setIsPlaying(newIsPlaying);

      if (newIsPlaying) {
        setIsLoading(false);
        setHasError(false);
      }

      if (status.didJustFinish && !status.isLooping && videoRef.current) {
        const shouldStillPlay = isVisible && isFocused && !userPaused;
        if (shouldStillPlay) {
          videoRef.current.replayAsync();
        }
      }
    }
  }, [isVisible, isFocused, userPaused]);

  // Retry loading the video after an error
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

  // Component mount/unmount logic
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
          <Ionicons name="videocam-off" size={60} color="#666" />
          <Text style={styles.errorText}>Invalid video</Text>
        </View>

        {/* Bottom Left User Info - Even for Error State */}
        <View style={styles.bottomLeftContainer}>
          <View style={styles.userInfoContainer}>
            <TouchableOpacity onPress={handleUserPress} style={styles.usernameRow}>
              <LinearGradient colors={['#ff6ec4', '#a855f7', '#3b82f6']} style={styles.profilePicture}>
                <Text style={styles.profileInitials}>{getUserInitials()}</Text>
              </LinearGradient>
              <Text style={styles.username} numberOfLines={1}>@{getUserDisplayName()}</Text>
            </TouchableOpacity>
            <View style={styles.instrumentsRow}>
              <Ionicons name="musical-notes" size={16} color="white" style={styles.musicIcon} />
              <Text style={styles.instruments} numberOfLines={2}>{getInstrumentsText()}</Text>
            </View>
          </View>
        </View>
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
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={500}
          rate={1.0}
          volume={1.0}
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
              <Ionicons
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
            setUserPaused(false);
            retryLoadVideo();
          }}>
            <Ionicons name="refresh" size={20} color="white" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Left User Info - Instagram Style with Profile Picture */}
        <View style={styles.bottomLeftContainer}>
          {/* User Info Container - FIXED HEIGHT TO PREVENT JUMPING */}
          <View style={styles.userInfoContainer}>
            {/* Username Row with Profile Picture - Instagram Style */}
            <TouchableOpacity onPress={handleUserPress} activeOpacity={0.7} style={styles.usernameRow}>
              {/* Profile Picture with Gradient */}
              <LinearGradient
                colors={['#ff6ec4', '#a855f7', '#3b82f6']}
                style={styles.profilePicture}
              >
                <Text style={styles.profileInitials}>
                  {getUserInitials()}
                </Text>
              </LinearGradient>

              {/* Username */}
              <Text style={styles.username} numberOfLines={1}>
                @{getUserDisplayName()}
              </Text>
            </TouchableOpacity>

            {/* Instruments Row - FIXED HEIGHT TO PREVENT MOVEMENT */}
            <View style={styles.instrumentsRow}>
              <Ionicons
                name="musical-notes"
                size={16}
                color="white"
                style={styles.musicIcon}
              />
              <Text style={styles.instruments} numberOfLines={2}>
                {getInstrumentsText()}
              </Text>
            </View>
          </View>
        </View>
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

  // BOTTOM LEFT USER INFO - MOVED HIGHER UP FOR BETTER POSITIONING
  bottomLeftContainer: {
    position: 'absolute',
    bottom: 80, // MOVED UP from 0 to 80px - much higher positioning
    left: 0,
    right: 80, // Leave space for potential right side actions
    height: 140, // Fixed height container - prevents any movement
    zIndex: 5,
  },
  textGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140, // Same as container height
  },
  userInfoContainer: {
    position: 'absolute',
    bottom: 45, // MOVED UP from 25 to 45px - higher positioning within container
    left: 20,   // Fixed distance from left - NEVER CHANGES
    right: 20,  // Fixed distance from right edge
    height: 90, // Fixed height - PREVENTS VERTICAL MOVEMENT
    justifyContent: 'space-between', // Distribute content evenly
  },

  // USERNAME ROW WITH PROFILE PICTURE - Instagram Style
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40, // Fixed height - PREVENTS USERNAME FROM MOVING
    marginBottom: 8, // Fixed spacing
  },
  profilePicture: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  profileInitials: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  username: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // INSTRUMENTS ROW - FIXED HEIGHT TO PREVENT JUMPING
  instrumentsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align to top of container
    height: 42, // Fixed height - PREVENTS INSTRUMENTS FROM MOVING UP/DOWN
    paddingTop: 2,
  },
  musicIcon: {
    marginRight: 8,
    marginTop: 2, // Slight adjustment for better alignment
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  instruments: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18, // Fixed line height - CONSISTENT TEXT SPACING
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});


export default VideoItem;

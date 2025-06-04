import React, { useState, useEffect, useRef } from 'react';
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
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import VideoInfo from './VideoInfo';
import * as FileSystem from 'expo-file-system';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VideoItem = ({ item, isVisible, height, shouldCache = false }) => {
  const videoRef = useRef(null);
  const isFocused = useIsFocused();
  const [paused, setPaused] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const retryCountRef = useRef(0);
  const colorScheme = useColorScheme();
  const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const cacheAttemptedRef = useRef(false);
  
  // Smart video caching - only for priority videos
  const cacheVideo = async (videoUrl) => {
    if (!shouldCache || cacheAttemptedRef.current) return null;
    cacheAttemptedRef.current = true;
    
    try {
      const filename = videoUrl.split('/').pop() || `video_${Date.now()}.mp4`;
      const localUri = `${FileSystem.cacheDirectory}videos/${filename}`;
      
      // Check if directory exists, create if not
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
      }

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        setLocalVideoUri(localUri);
        console.log('⚡ VideoItem: Using cached video');
        return localUri;
      }
      
      // Download only for priority videos (first 3)
      if (shouldCache) {
        console.log('📥 VideoItem: Caching priority video...');
        const downloadResult = await FileSystem.downloadAsync(videoUrl, localUri);
        
        if (downloadResult.status === 200) {
          setLocalVideoUri(localUri);
          console.log('✅ VideoItem: Video cached successfully');
          return localUri;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ VideoItem: Cache error:', error);
      return null;
    }
  };

  // Load and cache only when needed
  useEffect(() => {
    if (item.videoUrl && shouldCache) {
      cacheVideo(item.videoUrl);
    }
  }, [item.videoUrl, shouldCache]);

  // Simplified show play icon logic
  useEffect(() => {
    if (showPlayIcon) {
      const timeout = setTimeout(() => setShowPlayIcon(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [showPlayIcon]);

  // Simplified visibility handling
  useEffect(() => {
    if ((!isVisible || !isFocused) && videoRef.current) {
      videoRef.current.pauseAsync();
    } else if (isVisible && isFocused && videoRef.current && !paused) {
      videoRef.current.playAsync();
    }
  }, [isVisible, isFocused, paused]);

  // Simplified loading timeout
  useEffect(() => {
    if (isLoading && isPlaying) {
      const timer = setTimeout(() => setIsLoading(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isPlaying]);

  // Clear error when playing
  useEffect(() => {
    if (isPlaying && hasError) {
      setHasError(false);
    }
  }, [isPlaying, hasError]);

  const handleTogglePlayback = async () => {
    try {
      if (videoRef.current) {
        if (paused) {
          await videoRef.current.playAsync();
        } else {
          await videoRef.current.pauseAsync();
        }
        
        setPaused(!paused);
        setShowPlayIcon(true);
      }
    } catch (error) {
      console.error('❌ VideoItem: Playback toggle error:', error);
    }
  };

  const handleVideoLoad = () => {
    setTimeout(() => setIsLoading(false), 200);
    setHasError(false);
    retryCountRef.current = 0;
  };

  const handleVideoError = (error) => {
    console.error('❌ VideoItem: Video error:', error);
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    retryLoadVideo();
  };

  const handlePlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying && !status.isPaused);
      
      if (status.isPlaying) {
        setIsLoading(false);
        setHasError(false);
      }
      
      // Auto-repeat when video ends
      if (status.didJustFinish && !status.isLooping) {
        videoRef.current?.replayAsync();
      }
    }
  };

  const retryLoadVideo = async () => {
    retryCountRef.current += 1;
    const maxRetries = 3; // Reduced retry attempts
    
    if (retryCountRef.current > maxRetries) {
      console.log('❌ VideoItem: Max retries exceeded');
      setHasError(true);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`🔄 VideoItem: Retry attempt ${retryCountRef.current}`);
      
      if (videoRef.current) {
        await videoRef.current.unloadAsync();
        
        // Try cached version first, then original URL
        const videoSource = localVideoUri || item.videoUrl;
        await videoRef.current.loadAsync({ uri: videoSource }, {}, false);
        await videoRef.current.playAsync();
      }
    } catch (e) {
      console.error('❌ VideoItem: Retry failed:', e);
      setHasError(true);
      setIsLoading(false);
      
      if (retryCountRef.current < maxRetries) {
        setTimeout(() => retryLoadVideo(), 1000);
      }
    }
  };

  // Auto-clear error after delay
  useEffect(() => {
    if (hasError) {
      const errorTimeout = setTimeout(() => {
        if (retryCountRef.current >= 3) {
          setHasError(false);
        }
      }, 2000);
      return () => clearTimeout(errorTimeout);
    }
  }, [hasError]);

  return (
    <TouchableWithoutFeedback onPress={handleTogglePlayback}>
      <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
        <Video
          ref={videoRef}
          source={{ uri: localVideoUri || item.videoUrl }}
          style={styles.videoPlayer}
          resizeMode="cover"
          shouldPlay={isVisible && isFocused && !paused}
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={2000}
          rate={1.0}
          volume={1.0}
          // buffer config for smoother playback
          bufferConfig={{
            minBufferMs: 10000,
            maxBufferMs: 30000,
            bufferForPlaybackMs: 2000,
            bufferForPlaybackAfterRebufferMs: 3000
          }}
        />

        {showPlayIcon && (
          <View style={styles.centerOverlay}>
            <Icon
              name={paused ? 'play' : 'pause'}
              size={70}
              color={COLOR.icon}
              style={styles.playIcon}
            />
          </View>
        )}

        {/* Show loading only when truly needed */}
        {isLoading && !isPlaying && !showPlayIcon && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}

        {/* Manual retry button for failed videos */}
        {hasError && retryCountRef.current >= 3 && (
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            retryCountRef.current = 0;
            retryLoadVideo();
          }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        <VideoInfo video={{ username: item.user, description: item.description }} />
      </View>
    </TouchableWithoutFeedback>
  );
};

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
    top: '45%',
    left: '45%',
    zIndex: 10,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 40,
    left: 18,
  },
  playIcon: {
    alignSelf: 'center',
  },
  retryButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    top: '50%',
    alignSelf: 'center',
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  }
});

export default VideoItem;
/**
 * @module ProfileVideoSwiper
 * Video swiper component with smart caching and tiny loading spinners
 * Handles all video rendering, loading states, and user interactions
 */

import React, { useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Swiper from 'react-native-swiper';
import { COLORS, SIZES } from '../../styles/theme';

const { width } = Dimensions.get('window');

/**
 * @function ProfileVideoSwiper
 * @description Video swiper with smart caching, loading spinners, and smooth navigation
 * @param {Object} props - Component props
 * @param {Array} props.videoObjects - Array of video objects with cache info
 * @param {Function} props.onIndexChanged - Callback when video changes
 * @param {Function} props.togglePause - Function to toggle video pause
 * @param {Function} props.shouldVideoPlay - Function to check if video should play
 * @param {Function} props.handleVideoLoadStart - Video load start handler
 * @param {Function} props.handleVideoReadyForDisplay - Video ready handler
 * @param {Function} props.handleVideoLoadError - Video error handler
 * @param {Function} props.setVideoRef - Function to set video ref
 * @param {Object} props.videoStates - Current video loading states
 * @returns {JSX.Element}
 */
const ProfileVideoSwiper = ({
  videoObjects,
  onIndexChanged,
  togglePause,
  shouldVideoPlay,
  handleVideoLoadStart,
  handleVideoReadyForDisplay,
  handleVideoLoadError,
  setVideoRef,
  videoStates,
}) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const swiperRef = useRef(null);

  // Handle swiper index change
  const handleIndexChanged = (index) => {
    onIndexChanged(index, videoObjects);
  };

  if (videoObjects.length === 0) {
    return (
      <View style={styles.noVideosContainer}>
        <Ionicons name="videocam-outline" size={60} color={theme.textSecondary} />
        <Text style={[styles.noVideosText, { color: theme.textSecondary }]}>
          No videos uploaded yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <Swiper
        ref={swiperRef}
        style={styles.swiper}
        showsPagination={true}
        loop={false}
        onIndexChanged={handleIndexChanged}
        dotStyle={styles.dot}
        activeDotStyle={styles.activeDot}
        paginationStyle={styles.pagination}
        removeClippedSubviews={false} // Keep videos in memory for caching
        loadMinimal={false} // Load all videos for better caching
        scrollEnabled={true}
        showsButtons={false}
        width={width}
      >
        {videoObjects.map((video, index) => (
          <View key={video.id} style={styles.slide}>
            <TouchableOpacity 
              style={styles.videoWrapper} 
              onPress={() => togglePause(video.id)}
              activeOpacity={0.9}
            >
              {/* VIDEO WITH SMART CACHING */}
              <Video
                ref={(ref) => setVideoRef(video.id, ref)}
                source={{ uri: video.uri }}
                style={styles.video}
                resizeMode="cover"
                isLooping
                shouldPlay={shouldVideoPlay(video.id, index)}
                isMuted={false}
                onLoadStart={() => handleVideoLoadStart(video.id)}
                onReadyForDisplay={() => handleVideoReadyForDisplay(video.id)}
                onError={(error) => handleVideoLoadError(video.id, error)}
              />

              {/* TINY LOADING SPINNER OVERLAY */}
              {video.isLoading && (
                <View style={styles.videoLoadingOverlay}>
                  <View style={styles.tinySpinnerContainer}>
                    <ActivityIndicator 
                      size="small" 
                      color="#ff6ec4" 
                      style={styles.tinySpinner}
                    />
                  </View>
                </View>
              )}

              {/* Error state indicator */}
              {videoStates[video.id] === 'error' && (
                <View style={styles.videoErrorOverlay}>
                  <Ionicons name="warning-outline" size={30} color="#ff6b6b" />
                  <Text style={styles.videoErrorText}>Video unavailable</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </Swiper>
    </View>
  );
};

const styles = StyleSheet.create({
  videoContainer: {
    height: 400,
    marginBottom: 20,
    width: width - 40,
    overflow: 'hidden',
  },
  noVideosContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: SIZES.radius,
    marginBottom: 20,
  },
  noVideosText: {
    marginTop: 10,
    fontSize: 16,
    fontStyle: 'italic',
  },
  swiper: {
    height: 400,
  },
  slide: {
    width: width - 40,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoWrapper: {
    width: width - 40,
    height: 400,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: width - 40,
    height: 400,
    borderRadius: SIZES.radius,
    backgroundColor: '#111',
  },
  
  // Tiny loading spinner overlay
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: SIZES.radius,
  },
  tinySpinnerContainer: {
    backgroundColor: 'rgba(255, 110, 196, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  tinySpinner: {
    // Small spinner like TikTok/Instagram
  },

  // Video error overlay
  videoErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: SIZES.radius,
  },
  videoErrorText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  pagination: {
    bottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: '#fff',
  },
});

export default ProfileVideoSwiper;
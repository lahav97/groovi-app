/**
 * @module MusicianProfileScreen
 * Discovery screen that loads musicians from database for swiping
 * TikTok-style swiping with Bumble-style profile expansion
 * FIXED: Video fetching, Tinder-style gestures, better card sizing
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { fetchVideos } from '../../services/videoService';
import { fetchUserProfile } from '../../services/profileService';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { LAYOUT } from '../../styles/theme';
import {
  ERROR_MESSAGES,
  handleError
} from '../../utils/errors';
import { COLORS } from '../../styles/theme';

const { width, height } = Dimensions.get('window');

// ✅ IMPROVED CARD SIZING - More breathing room
const CARD_WIDTH = width - 40; // More horizontal margin (20px each side)
const CARD_HEIGHT = height * 0.7; // Reduced from 80% to 70%
const VIDEO_HEIGHT = CARD_HEIGHT * 0.65; // Slightly more video space

// Configuration
const MUSICIANS_CONFIG = {
  BATCH_SIZE: 5,           
  PRELOAD_THRESHOLD: 2,    
};

// ✅ TINDER-STYLE SWIPE ZONES
const SWIPE_ZONES = {
  LEFT_ZONE: width * 0.25,  // Left 25% = Pass
  RIGHT_ZONE: width * 0.75, // Right 75% = Message
  MIN_DISTANCE: 80,          // Minimum drag distance for decision
  VELOCITY_THRESHOLD: 300,   // High velocity overrides distance
};

/**
 * @function MusicianProfileScreen
 * @description Discovery screen with Tinder-style gestures and fixed video fetching
 */
const MusicianProfileScreen = ({ 
  onSwipeRight, 
  onSwipeLeft, 
  onViewFullProfile 
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [musicians, setMusicians] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoPage, setVideoPage] = useState(0);
  const [processedUsernames, setProcessedUsernames] = useState(new Set());
  
  // ✅ IMPROVED ANIMATION REFS - Smooth Tinder-style movement
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const videoRef = useRef(null);

  /**
   * ✅ FIXED: loadMusicians - Uses correct 'videos' field instead of 'videoUrls'
   */
  const loadMusicians = async (isLoadingMore = false) => {
    try {
      if (!isLoadingMore) {
        setLoading(true);
        console.log('🎵 Starting to load musicians...');
      } else {
        setLoadingMore(true);
        console.log('🎵 Loading more musicians...');
      }
      
      // Step 1: Get videos from feed API to extract usernames
      console.log('📹 Step 1: Fetching videos from feed...');
      const videos = await fetchVideos(videoPage, 20);
      
      if (!videos || videos.length === 0) {
        console.log('❌ No videos found');
        if (!isLoadingMore) {
          Alert.alert('No Content', ERROR_MESSAGES.NETWORK.NO_MUSICIANS);
        }
        return;
      }

      console.log(`✅ Step 1 complete: Got ${videos.length} videos`);

      // Step 2: Extract unique usernames we haven't processed yet
      const newUsernames = [];
      const currentProcessed = isLoadingMore ? processedUsernames : new Set();
      
      for (const video of videos) {
        const username = video.username || video.user;
        if (username && !currentProcessed.has(username)) {
          newUsernames.push(username);
          currentProcessed.add(username);
          
          if (newUsernames.length >= MUSICIANS_CONFIG.BATCH_SIZE) {
            break;
          }
        }
      }

      if (newUsernames.length === 0) {
        console.log('⚠️ No new unique users found, trying next page...');
        setVideoPage(prev => prev + 1);
        setTimeout(() => loadMusicians(isLoadingMore), 500);
        return;
      }

      console.log(`👥 Step 2: Found ${newUsernames.length} new unique users:`, newUsernames);

      // Step 3: Load full profiles for each unique user
      console.log('📋 Step 3: Loading full profiles...');
      const profilePromises = newUsernames.map(async (username) => {
        try {
          console.log(`🔍 Loading profile for: ${username}`);
          const profile = await fetchUserProfile('username', username);
          
          if (profile && (profile.success || profile.username)) {
            const userData = profile.profile || profile;
            
            // ✅ FIXED: Use correct 'videos' field instead of 'videoUrls'
            if (userData.videos && userData.videos.length > 0) {
              // Profile API has all user videos - use those!
              console.log(`📹 Using profile videos for ${username}: ${userData.videos.length} videos`);
            } else {
              // Fallback: use videos from feed if profile doesn't have any
              const userVideos = videos.filter(video => 
                (video.username === username || video.user === username)
              );
              
              if (userVideos.length > 0) {
                userData.videos = userVideos.map(video => video.video_url || video.videoUrl);
                console.log(`📹 Fallback to feed videos for ${username}: ${userVideos.length} videos`);
              } else {
                console.log(`📹 No videos found for ${username}`);
              }
            }
            
            console.log(`✅ Profile loaded for: ${username} with ${userData.videos?.length || 0} videos`);
            return userData;
          } else {
            console.log(`⚠️ Invalid profile data for: ${username}`);
            return null;
          }
        } catch (error) {
          if (error.response && error.response.data && error.response.data.error && 
              error.response.data.error.includes('Decimal')) {
            console.log(`⚠️ Skipping ${username} due to backend data format issue`);
            return null;
          }
          console.error(`❌ Failed to load profile for ${username}:`, error.message);
          return null;
        }
      });

      const profiles = await Promise.all(profilePromises);
      const validProfiles = profiles.filter(profile => profile !== null);

      console.log(`✅ Step 3 complete: Loaded ${validProfiles.length} valid profiles`);

      if (validProfiles.length === 0) {
        console.log('❌ No valid profiles loaded');
        if (!isLoadingMore) {
          Alert.alert('Error', 'Failed to load musician profiles. Please try again.');
        }
        return;
      }

      // Update state
      if (isLoadingMore) {
        setMusicians(prev => [...prev, ...validProfiles]);
      } else {
        setMusicians(validProfiles);
        setCurrentIndex(0);
        setCurrentVideoIndex(0);
      }

      setProcessedUsernames(currentProcessed);
      setVideoPage(prev => prev + 1);

      console.log(`🎉 Successfully loaded ${validProfiles.length} musicians!`);

    } catch (error) {
      console.error('❌ Error loading musicians:', error);
      Alert.alert('Error', handleError(error, 'MusicianProfileScreen/loadMusicians'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMusicians = () => {
    if (!loadingMore && musicians.length - currentIndex <= MUSICIANS_CONFIG.PRELOAD_THRESHOLD) {
      console.log('🔄 Loading more musicians (running low)...');
      loadMusicians(true);
    }
  };

  useEffect(() => {
    loadMusicians();
  }, []);

  useEffect(() => {
    setCurrentVideoIndex(0);
  }, [currentIndex]);

  const currentMusician = musicians[currentIndex];

  /**
   * ✅ IMPROVED: Tinder-style PanResponder - Allows movement in ANY direction
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: () => {
        // Reset any ongoing animations
        translateX.stopAnimation();
        translateY.stopAnimation();
        rotation.stopAnimation();
        scale.stopAnimation();
      },

      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        // ✅ SMOOTH FOLLOWING - Card follows finger in ANY direction
        translateX.setValue(dx);
        translateY.setValue(dy);
        
        // Dynamic rotation based on horizontal movement
        const rotationValue = dx / width * 0.5; // Max 0.5 radians rotation
        rotation.setValue(rotationValue);
        
        // Dynamic scaling - slightly smaller when dragging
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scaleValue = Math.max(0.9, 1 - distance / (width * 2));
        scale.setValue(scaleValue);
        
        // Dynamic opacity based on distance from center
        const maxDistance = width * 0.8;
        const opacityValue = Math.max(0.3, 1 - distance / maxDistance);
        opacity.setValue(opacityValue);
      },

      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = Math.sqrt(vx * vx + vy * vy);
        
        // ✅ TINDER-STYLE DECISION ZONES
        const finalX = evt.nativeEvent.pageX;
        const isHighVelocity = velocity > SWIPE_ZONES.VELOCITY_THRESHOLD;
        const isSignificantDistance = distance > SWIPE_ZONES.MIN_DISTANCE;
        
        // Decision logic: final position OR high velocity
        if (isHighVelocity || isSignificantDistance) {
          if (finalX < SWIPE_ZONES.LEFT_ZONE || (isHighVelocity && vx < -SWIPE_ZONES.VELOCITY_THRESHOLD)) {
            // LEFT ZONE = Pass
            handleSwipeLeft();
          } else if (finalX > SWIPE_ZONES.RIGHT_ZONE || (isHighVelocity && vx > SWIPE_ZONES.VELOCITY_THRESHOLD)) {
            // RIGHT ZONE = Message
            handleSwipeRight();
          } else {
            // MIDDLE ZONE = Return to center
            resetCard();
          }
        } else {
          // Small movement = Return to center
          resetCard();
        }
      },
    })
  ).current;

  /**
   * ✅ IMPROVED: resetCard - Smoother animations
   */
  const resetCard = () => {
    Animated.parallel([
      Animated.spring(translateX, { 
        toValue: 0, 
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(translateY, { 
        toValue: 0, 
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(scale, { 
        toValue: 1, 
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(rotation, { 
        toValue: 0, 
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(opacity, { 
        toValue: 1, 
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  };

  /**
   * ✅ IMPROVED: handleSwipeRight with smoother exit animation
   */
  const handleSwipeRight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.parallel([
      Animated.timing(translateX, { 
        toValue: width * 1.5, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(translateY, { 
        toValue: -height * 0.1, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(rotation, { 
        toValue: 0.5, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(opacity, { 
        toValue: 0, 
        duration: 300, 
        useNativeDriver: true 
      }),
    ]).start(() => {
      console.log('💕 User swiped RIGHT - Send message to:', currentMusician?.username);
      onSwipeRight && onSwipeRight(currentMusician);
      moveToNextMusician();
    });
  };

  /**
   * ✅ IMPROVED: handleSwipeLeft with smoother exit animation
   */
  const handleSwipeLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.parallel([
      Animated.timing(translateX, { 
        toValue: -width * 1.5, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(translateY, { 
        toValue: -height * 0.1, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(rotation, { 
        toValue: -0.5, 
        duration: 300, 
        useNativeDriver: true 
      }),
      Animated.timing(opacity, { 
        toValue: 0, 
        duration: 300, 
        useNativeDriver: true 
      }),
    ]).start(() => {
      console.log('❌ User swiped LEFT - Pass on:', currentMusician?.username);
      onSwipeLeft && onSwipeLeft(currentMusician);
      moveToNextMusician();
    });
  };

  const moveToNextMusician = () => {
    if (currentIndex < musicians.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCurrentVideoIndex(0);
      resetCard();
      loadMoreMusicians();
    } else {
      if (!loadingMore) {
        loadMusicians(true);
      } else {
        Alert.alert('No more musicians', 'You\'ve seen all available musicians!', [
          { text: 'Reload', onPress: () => {
            setCurrentIndex(0);
            setCurrentVideoIndex(0);
            setProcessedUsernames(new Set());
            setVideoPage(0);
            loadMusicians();
          }}
        ]);
      }
    }
  };

  /**
   * ✅ FIXED: Video navigation - Uses correct 'videos' field
   */
  const handleVideoSideTap = (side) => {
    // ✅ FIXED: Use 'videos' instead of 'videoUrls'
    if (!currentMusician?.videos || currentMusician.videos.length <= 1) {
      console.log('⚠️ Single video - no navigation needed');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (side === 'left') {
      setCurrentVideoIndex(prev => 
        prev > 0 ? prev - 1 : currentMusician.videos.length - 1
      );
    } else {
      setCurrentVideoIndex(prev => 
        prev < currentMusician.videos.length - 1 ? prev + 1 : 0
      );
    }
  };

  const toggleVideoPlayback = () => {
    setPaused(!paused);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const calculateDistance = () => {
    const distances = ['1.2 km', '2.5 km', '4.8 km', '6.1 km', '8.3 km'];
    return distances[Math.floor(Math.random() * distances.length)];
  };

  const renderStars = (rating = 5) => {
    return [...Array(5)].map((_, index) => (
      <Text key={index} style={styles.star}>
        {index < rating ? '⭐' : '☆'}
      </Text>
    ));
  };

  const renderGenreTags = () => {
    if (!currentMusician?.genres || currentMusician.genres.length === 0) return null;
    
    return (
      <View style={styles.genreTags}>
        {currentMusician.genres.slice(0, 2).map((genre, index) => (
          <View key={index} style={styles.genreTag}>
            <Text style={styles.genreTagText}>{genre}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderInstruments = () => {
    if (!currentMusician?.instruments) return null;
    
    const instrumentList = typeof currentMusician.instruments === 'object' 
      ? Object.keys(currentMusician.instruments) 
      : currentMusician.instruments;
    
    return (
      <View style={styles.instrumentsContainer}>
        {instrumentList.slice(0, 3).map((instrument, index) => (
          <View key={index} style={styles.instrumentTag}>
            <Text style={styles.instrumentTagText}>{instrument}</Text>
          </View>
        ))}
        {instrumentList.length > 3 && (
          <Text style={styles.moreInstruments}>+{instrumentList.length - 3} more</Text>
        )}
      </View>
    );
  };

  // Loading states
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.button.secondary} />
        <Text style={styles.loadingText}>Finding amazing musicians...</Text>
        <Text style={styles.loadingSubText}>Loading profiles...</Text>
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  if (!musicians || musicians.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No musicians found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMusicians()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  if (!currentMusician) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Loading more musicians...</Text>
        <ActivityIndicator size="large" color="#ff6ec4" style={{ marginTop: 20 }} />
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  const distance = calculateDistance();
  // ✅ FIXED: Use correct 'videos' field
  const hasMultipleVideos = currentMusician?.videos && currentMusician.videos.length > 1;
  const currentVideoUrl = currentMusician?.videos?.[currentVideoIndex];
  const videoCount = currentMusician?.videos?.length || 0;

  console.log('🎥 Smart card adaptation:', {
    username: currentMusician?.username,
    videoCount,
    currentVideoIndex,
    hasMultipleVideos,
    showVideoControls: hasMultipleVideos,
    displayCounter: `${currentVideoIndex + 1} of ${videoCount}`
  });

  return (
    <View style={styles.container}>
      {/* Current Card */}
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              { translateX },
              { translateY },
              { scale },
              { rotate: rotation.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-30deg', '30deg']
              })}
            ],
            opacity,
            zIndex: 2,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Video Section with Invisible Tap Areas */}
        <View style={styles.videoContainer}>
          {/* Left Tap Area - Invisible, only for multiple videos */}
          {hasMultipleVideos && (
            <TouchableOpacity 
              style={styles.videoSideTap}
              onPress={() => handleVideoSideTap('left')}
              activeOpacity={1}
            />
          )}

          {/* Main Video Area */}
          <TouchableOpacity 
            style={hasMultipleVideos ? styles.videoMainArea : styles.videoFullArea} 
            onPress={toggleVideoPlayback}
            activeOpacity={0.9}
          >
            {currentVideoUrl ? (
              <Video
                ref={videoRef}
                source={{ uri: currentVideoUrl }}
                style={styles.video}
                resizeMode="cover"
                shouldPlay={!paused}
                isLooping
                isMuted={false}
              />
            ) : (
              <View style={styles.noVideoContainer}>
                <Ionicons name="musical-notes" size={60} color="#ccc" />
                <Text style={styles.noVideoText}>No videos available</Text>
              </View>
            )}

            {paused && (
              <View style={styles.playButtonContainer}>
                <Ionicons name="play" size={40} color="rgba(255,255,255,0.8)" />
              </View>
            )}
          </TouchableOpacity>

          {/* Right Tap Area - Invisible, only for multiple videos */}
          {hasMultipleVideos && (
            <TouchableOpacity 
              style={styles.videoSideTap}
              onPress={() => handleVideoSideTap('right')}
              activeOpacity={1}
            />
          )}

          {/* Overlays */}
          {renderGenreTags()}

          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>{distance}</Text>
          </View>

          {hasMultipleVideos && (
            <View style={styles.videoDots}>
              {currentMusician.videos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentVideoIndex && styles.activeDot
                  ]}
                />
              ))}
            </View>
          )}

          {hasMultipleVideos && (
            <View style={styles.videoCounter}>
              <Text style={styles.videoCounterText}>
                {currentVideoIndex + 1} of {videoCount}
              </Text>
            </View>
          )}
        </View>

        {/* ✅ IMPROVED: Profile Section with better spacing */}
        <View style={styles.profileSection}>
          <View style={styles.userInfoRow}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle-outline" size={32} color="#666" />
            </View>
            <Text style={styles.username}>@{currentMusician.username}</Text>
            <Text style={styles.ageLocation}>
              {currentMusician.age && `${currentMusician.age} • `}{currentMusician.location}
            </Text>
          </View>

          <View style={styles.ratingContainer}>
            {renderStars(currentMusician.rating)}
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color="#666" />
            <Text style={styles.bioText} numberOfLines={2}>
              {currentMusician.bio || 'Music enthusiast looking to connect!'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="musical-notes-outline" size={20} color="#666" />
            {renderInstruments()}
          </View>

          {currentMusician.socialLink && (
            <View style={styles.infoRow}>
              <Ionicons name="link-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{currentMusician.socialLink}</Text>
            </View>
          )}

          <View style={styles.counterContainer}>
            <Text style={styles.counterText}>
              {currentIndex + 1} of {musicians.length}
            </Text>
            {loadingMore && (
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            )}
          </View>

          {/* ✅ SIMPLIFIED: Better swipe hint - only shows swipe zones */}
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>← Pass • Message →</Text>
          </View>
        </View>
      </Animated.View>

      {/* Next Card Preview - Just white card outline */}
      {musicians[currentIndex + 1] && (
        <View style={styles.nextCardPreview}>
          <View style={styles.nextCard}>
            {/* Empty white card - no content, just teaser */}
          </View>
        </View>
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
        <BottomNavigation />
      </View>
    </View>
  );
};

// ✅ IMPROVED STYLES: Better spacing, card sizing, and visual hierarchy
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80, // More top spacing
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 20, // Larger border radius
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
    alignSelf: 'center',
    marginBottom: 40, // Bottom margin for breathing room
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    color: '#333',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubText: {
    color: '#666',
    marginTop: 5,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: '#ff4458',
  },
  videoContainer: {
    height: VIDEO_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
  },
  videoSideTap: {
    width: width * 0.15,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    // Invisible tap areas - no visual indicators
  },
  videoMainArea: {
    flex: 1,
    height: '100%',
  },
  videoFullArea: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  playButtonContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  genreTags: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  genreTag: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  distanceContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  distanceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  videoDots: {
    position: 'absolute',
    bottom: 15,
    left: '50%',
    transform: [{ translateX: -20 }],
    flexDirection: 'row',
    gap: 6,
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  videoCounter: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  videoCounterText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  profileSection: {
    flex: 1,
    padding: 24, // Increased padding for better spacing
    paddingTop: 20,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarContainer: {
    marginRight: 12,
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  ageLocation: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  star: {
    fontSize: 16,
    marginRight: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingRight: 8,
  },
  bioText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  instrumentsContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  instrumentTag: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  instrumentTagText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  moreInstruments: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  counterContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  loadingMoreText: {
    fontSize: 11,
    color: '#ff6ec4',
    marginTop: 4,
    fontWeight: '500',
  },
  swipeHint: {
    marginTop: 12,
    alignItems: 'center',
    opacity: 0.7,
  },
  swipeHintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#ff6ec4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#ff6ec4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    zIndex: 10,
  },
  // Next card preview styles
  nextCardPreview: {
    position: 'absolute',
    top: 90, // Slightly lower than main card
    left: 50, // More offset to show it's behind
    right: 50,
    bottom: 120,
    zIndex: 1, // Behind main card
  },
  nextCard: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    opacity: 0.8, // Slightly transparent
  },
  nextCardVideo: {
    height: '65%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  nextVideo: {
    width: '100%',
    height: '100%',
  },
  nextVideoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  nextCardInfo: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  nextCardUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    textAlign: 'center',
  },
});

export default MusicianProfileScreen;
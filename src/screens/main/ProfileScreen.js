/**
 * @module ProfileScreen
 * Displays the user's profile with videos, user information, and interactive elements.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { useNavigation } from '@react-navigation/native';
import userProfileManager from '../../hooks/userProfileManager';

const { width } = Dimensions.get('window');

/**
 * @function ProfileScreen
 * @description Displays the current user's profile page including video swiper, info, and bottom navigation.
 * @returns {JSX.Element}
 */
const ProfileScreen = () => {
  const navigation = useNavigation();
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});
  const swiperRef = useRef(null);

  console.log('🔍 ProfileScreen: Component rendering');

  // Load current user's profile
  const { 
    profile, 
    loading, 
    error, 
    refreshProfile 
  } = userProfileManager({
    autoLoad: true,
    loadOnFocus: true
  });

  // DEBUG: Log profile data
  useEffect(() => {
    console.log('🔍 ProfileScreen: Profile state changed', {
      hasProfile: !!profile,
      loading,
      error: error || 'No error'
    });

    if (profile) {
      console.log('🎥 ProfileScreen: Profile data:', {
        username: profile.username,
        videosCount: profile.videos ? profile.videos.length : 0,
        videosType: typeof profile.videos,
        instruments: profile.instruments,
        bio: profile.bio
      });
      
      if (profile.videos) {
        console.log('🎬 ProfileScreen: Videos data:', profile.videos);
      }
    }
  }, [profile, loading, error]);

  /**
   * Convert profile videos (array of URL strings) to video objects
   */
  const getVideoObjects = () => {
    if (!profile?.videos || !Array.isArray(profile.videos)) {
      console.log('⚠️ ProfileScreen: No videos found in profile');
      return [];
    }

    const videoObjects = profile.videos.map((videoUrl, index) => ({
      id: `profile-video-${index}`,
      uri: videoUrl
    }));

    console.log('🎬 ProfileScreen: Created video objects:', videoObjects.length);
    return videoObjects;
  };

  const videoObjects = getVideoObjects();

  /**
   * @function togglePause
   * @description Pauses or resumes a video when the user taps on it.
   * @param {string} id - Video ID
   */
  const togglePause = (id) => {
    console.log('🎬 ProfileScreen: Toggle pause for video:', id);
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * @function onRefresh
   * @description Handle pull-to-refresh
   */
  const onRefresh = async () => {
    console.log('🔄 ProfileScreen: Refreshing profile...');
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      console.error('❌ ProfileScreen: Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isFocused) {
      console.log('📱 ProfileScreen: Screen lost focus, pausing videos');
      // Pause all videos when screen is not focused
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    } else {
      console.log('📱 ProfileScreen: Screen gained focus');
    }
  }, [isFocused]);

  /**
   * @function onIndexChanged
   * @description Handles changes in the video swiper index.
   * @param {number} index - The index of the newly active video.
   */
  const onIndexChanged = (index) => {
    console.log(`🎬 ProfileScreen: Video index changed to: ${index}`);
    setCurrentIndex(index);
    
    // Pause all videos except the current one
    videoObjects.forEach(video => {
      if (video.id !== videoObjects[index].id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync();
      }
    });
    
    // Play the current video if it's not manually paused
    if (!pausedStatus[videoObjects[index].id] && videoRefs.current[videoObjects[index].id]?.playAsync) {
      videoRefs.current[videoObjects[index].id].playAsync();
    }
  };

  /**
   * Format instruments for display
   */
  const formatInstruments = () => {
    if (!profile?.instruments) return 'Guitar, Acoustic Guitar';
    
    if (typeof profile.instruments === 'object') {
      return Object.keys(profile.instruments).join(', ');
    }
    
    if (Array.isArray(profile.instruments)) {
      return profile.instruments.join(', ');
    }
    
    return profile.instruments.toString();
  };

  // Loading state
  if (loading && !profile) {
    console.log('📱 ProfileScreen: Showing loading state');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6ec4" />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading your profile...</Text>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

  // Error state  
  if (error && !profile) {
    console.log('❌ ProfileScreen: Showing error state:', error);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>Failed to load profile</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshProfile}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

  console.log('✅ ProfileScreen: Rendering main profile view');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Icons */}
      <View style={styles.topIcons}>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
          <Ionicons name="create-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 30 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
            colors={['#ff6ec4']}
          />
        }
      >
        {/* DEBUG BOX - Remove this when everything works */}
        {/* <View style={styles.debugBox}>
          <Text style={styles.debugText}>
            DEBUG: Profile = {profile ? 'LOADED' : 'NOT LOADED'}
          </Text>
          <Text style={styles.debugText}>
            Videos: {videoObjects.length} found
          </Text>
        </View> */}

        {/* Video Swiper */}
        {videoObjects.length > 0 ? (
          <View style={styles.videoContainer}>
            <Swiper
              ref={swiperRef}
              style={styles.swiper}
              showsPagination={true}
              loop={false}
              onIndexChanged={onIndexChanged}
              dotStyle={styles.dot}
              activeDotStyle={styles.activeDot}
              paginationStyle={styles.pagination}
              removeClippedSubviews={true}
              loadMinimal={true}
              loadMinimalSize={1}
              scrollEnabled={true}
              showsButtons={false}
              width={width}
            >
              {videoObjects.map((video) => {
                console.log(`🎬 ProfileScreen: Rendering video ${video.id} with URI:`, video.uri);
                return (
                  <View key={video.id} style={styles.slide}>
                    <TouchableOpacity 
                      style={styles.videoWrapper} 
                      onPress={() => togglePause(video.id)}
                      activeOpacity={0.9}
                    >
                      <Video
                        ref={(ref) => { 
                          videoRefs.current[video.id] = ref;
                          console.log(`🎬 ProfileScreen: Video ref set for ${video.id}`);
                        }}
                        source={{ uri: video.uri }}
                        style={styles.video}
                        resizeMode="cover"
                        isLooping
                        shouldPlay={
                          !pausedStatus[video.id] && 
                          isFocused && 
                          currentIndex === videoObjects.findIndex(v => v.id === video.id)
                        }
                        useNativeControls={false}
                        isMuted={false}
                        onLoad={() => {
                          console.log(`✅ ProfileScreen: Video ${video.id} loaded successfully`);
                        }}
                        onLoadStart={() => {
                          console.log(`⏳ ProfileScreen: Video ${video.id} loading started`);
                        }}
                        onBuffer={() => {
                          console.log(`📶 ProfileScreen: Video ${video.id} buffering`);
                        }}
                        onError={(error) => {
                          console.log(`❌ ProfileScreen: Video ${video.id} error:`, error);
                        }}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Swiper>
          </View>
        ) : (
          <View style={styles.noVideosContainer}>
            <Ionicons name="videocam-outline" size={60} color={theme.textSecondary} />
            <Text style={[styles.noVideosText, { color: theme.textSecondary }]}>
              No videos uploaded yet
            </Text>
          </View>
        )}

        <View style={styles.usernameSection}>
          <Ionicons name="person-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.username, { color: theme.text }]}>
            @{profile?.username || 'Loading...'}
          </Text>
        </View>

        <View style={styles.stars}>
          {[...Array(5)].map((_, i) => (
            <FontAwesome key={i} name="star" size={SIZES.iconSmall || 16} color="gold" />
          ))}
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="information-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            {profile?.bio || 'I love to play the guitar !!'}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="musical-notes-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            {formatInstruments()}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            {profile?.address || profile?.location || 'Tel Aviv'}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="link-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            {profile?.social_links || '@social_link'}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <BottomNavigation />
      </View>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#ff6ec4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugBox: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 2,
  },
  topIcons: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingTop: 120,
    paddingHorizontal: 20,
  },
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
  },
  video: {
    width: width - 40,
    height: 400,
    borderRadius: SIZES.radius,
    backgroundColor: '#111',
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
  usernameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: SIZES.font.large,
    fontWeight: '600',
    marginLeft: 10,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: SIZES.font.medium,
    marginLeft: 10,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LAYOUT.navHeight,
    backgroundColor: '#000',
    zIndex: 100,
    justifyContent: 'center',
  },
});
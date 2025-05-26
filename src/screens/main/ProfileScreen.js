/**
 * @module ProfileScreen
 * Enhanced profile screen with cache-first loading for instant navigation
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
import { Ionicons, FontAwesome, AntDesign } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUserEmail } from '../../utils/userUtils';
import { fetchUserProfile } from '../../services/profileService';
import { getProfileCache, cacheUserProfile, clearProfileCache } from '../../utils/cacheManager';
import { signOut } from '../../services/authService';

const { width } = Dimensions.get('window');

/**
 * @function ProfileScreen
 * @description Enhanced profile screen with cache-first loading for instant performance
 * @returns {JSX.Element}
 */
const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadSource, setLoadSource] = useState(''); // Track cache vs API loading
  
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});
  const swiperRef = useRef(null);

  const handleLogout = async () => {
    console.log('Logout button pressed');
    try {
      // Get user email
      const userEmail = user?.email || await getCurrentUserEmail();
      if (userEmail) {
        // Clear profile cache for the current user
        await clearProfileCache(userEmail);
        console.log(`✅ Profile cache cleared for user: ${userEmail}`);
      }

      // Sign out the user
      await signOut();
      console.log('✅ User signed out');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Optionally display an error message to the user
    }
  };

  // ============================================================================
  // CACHE-FIRST PROFILE LOADING
  // ============================================================================

  /**
   * Load profile with cache-first approach
   */
  const loadProfileWithCacheFirst = async (forceRefresh = false) => {
    try {
      console.log('⚡ ProfileScreen: Starting cache-first profile loading...');
      setLoading(true);
      setError(null);

      // Get user email
      const userEmail = user?.email || await getCurrentUserEmail();
      if (!userEmail) {
        setError('User email not found');
        setLoading(false);
        return;
      }

      // STEP 1: Try cache first (unless force refresh)
      if (!forceRefresh) {
        console.log('📦 ProfileScreen: Checking profile cache...');
        const cachedProfile = await getProfileCache(userEmail);
        
        if (cachedProfile) {
          console.log('⚡ ProfileScreen: Using cached profile (INSTANT LOAD)');
          setProfile(cachedProfile);
          setLoadSource('cache');
          setLoading(false);
          return;
        }
      }

      // STEP 2: Load from API
      console.log('📡 ProfileScreen: Loading profile from API...');
      setLoadSource('api');
      
      const profileData = await fetchUserProfile('email', userEmail);
      
      if (profileData) {
        console.log('✅ ProfileScreen: Profile loaded from API');
        setProfile(profileData);
        
        // Cache for next time
        await cacheUserProfile(profileData, userEmail);
        console.log('💾 ProfileScreen: Profile cached');
      } else {
        setError('Profile not found');
      }
    } catch (err) {
      console.error('❌ ProfileScreen: Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = async () => {
    console.log('🔄 ProfileScreen: Refreshing profile...');
    setRefreshing(true);
    await loadProfileWithCacheFirst(true); // Force refresh
    setRefreshing(false);
  };

  // ============================================================================
  // VIDEO HANDLING
  // ============================================================================

  /**
   * Convert profile videos (array of URL strings) to video objects
   */
  const getVideoObjects = () => {
    if (!profile?.videos || !Array.isArray(profile.videos)) {
      return [];
    }

    return profile.videos.map((videoUrl, index) => ({
      id: `profile-video-${index}`,
      uri: videoUrl
    }));
  };

  const videoObjects = getVideoObjects();

  /**
   * Toggle video pause/play
   */
  const togglePause = (id) => {
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * Handle video swiper index change
   */
  const onIndexChanged = (index) => {
    setCurrentIndex(index);
    
    // Pause all videos except current one
    videoObjects.forEach(video => {
      if (video.id !== videoObjects[index].id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync();
      }
    });
    
    // Play current video if not paused
    if (!pausedStatus[videoObjects[index].id] && videoRefs.current[videoObjects[index].id]?.playAsync) {
      videoRefs.current[videoObjects[index].id].playAsync();
    }
  };

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

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

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

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  // Load profile on mount
  useEffect(() => {
    loadProfileWithCacheFirst();
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Loading state
  if (loading && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6ec4" />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            {loadSource === 'cache' ? 'Loading from cache...' : 'Loading your profile...'}
          </Text>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

  // Error state  
  if (error && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>Failed to load profile</Text>
          <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProfileWithCacheFirst(true)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

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
        <TouchableOpacity onPress={handleLogout}>
          <AntDesign name="logout" size={SIZES.icon} color={theme.text} />
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
              {videoObjects.map((video, index) => (
                <View key={video.id} style={styles.slide}>
                  <TouchableOpacity 
                    style={styles.videoWrapper} 
                    onPress={() => togglePause(video.id)}
                    activeOpacity={0.9}
                  >
                    <Video
                      ref={(ref) => { videoRefs.current[video.id] = ref; }}
                      source={{ uri: video.uri }}
                      style={styles.video}
                      resizeMode="cover"
                      isLooping
                      shouldPlay={
                        !pausedStatus[video.id] && 
                        isFocused && 
                        currentIndex === index
                      }
                      isMuted={false}
                      onError={(error) => {
                        console.log(`❌ ProfileScreen: Video ${video.id} error:`, error);
                      }}
                    />
                  </TouchableOpacity>
                </View>
              ))}
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

        {/* Profile Information */}
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
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
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

export default ProfileScreen;
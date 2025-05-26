/**
 * @module ProfileScreen
 * Enhanced profile screen with logout button that clears all user data and cache
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
  Alert,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUserEmail } from '../../utils/userUtils';
import { fetchUserProfile } from '../../services/profileService';
import { getProfileCache, cacheUserProfile, clearAllCaches } from '../../utils/cacheManager';

const { width } = Dimensions.get('window');

/**
 * @function ProfileScreen
 * @description Enhanced profile screen with logout functionality that clears all data
 * @returns {JSX.Element}
 */
const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadSource, setLoadSource] = useState(''); // Track cache vs API loading
  
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});
  const swiperRef = useRef(null);

  /**
   * Handle logout with complete data cleanup
   */
  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? This will clear all cached data from your device.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  /**
   * Perform the actual logout with data cleanup
   */
  const performLogout = async () => {
    setLoggingOut(true);
    console.log('🚪 ProfileScreen: Starting complete logout process...');

    try {
      // Step 1: Clear ALL caches (feed, profile, videos, etc.)
      console.log('🧹 ProfileScreen: Clearing all caches...');
      await clearAllCaches();
      
      // Step 2: Sign out from auth service (this also clears user data from AsyncStorage)
      console.log('🔐 ProfileScreen: Signing out user...');
      const result = await signOut();
      
      if (result.success) {
        console.log('✅ ProfileScreen: Complete logout successful');
        
        // Step 3: Reset local state
        setProfile(null);
        setLoading(false);
        setError(null);
        
        // Step 4: Don't navigate - let AuthContext handle the redirect
        // Since isSignedIn is now false, AppNavigator will automatically show AuthStack
        console.log('✅ ProfileScreen: Logout complete, AuthContext will handle navigation');
      } else {
        console.error('❌ ProfileScreen: Logout failed:', result.error);
        Alert.alert(
          'Logout Failed',
          result.error || 'Unable to sign out. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ ProfileScreen: Error during logout:', error);
      Alert.alert(
        'Logout Error',
        'An error occurred while signing out. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoggingOut(false);
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
      </View>

      {/* Content */}
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 80 }]} // Extra padding for logout button
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

        {/* Logout Button at Bottom */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.7}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#ff6ec4" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="log-out-outline" size={20} color="#ff6ec4" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.logoutText}>
            {loggingOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
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
  // NEW LOGOUT BUTTON STYLES
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 110, 196, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 30,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#ff6ec4',
    shadowColor: '#ff6ec4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    color: '#ff6ec4',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
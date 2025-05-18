import React, { useRef, useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import Swiper from 'react-native-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useProfileManager from '../../hooks/useProfileManager';
import { useAuth } from '../../context/AuthContext';


const { width } = Dimensions.get('window');
/**
 * @function ProfileScreen
 * @description Displays the user's profile page including video swiper, info, and bottom navigation.
 * @returns {JSX.Element}
 */
const ProfileScreen = ({ route, navigation }) => { 
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});
  const swiperRef = useRef(null);
  const { signOut } = useAuth();
  // Use the ProfileManager hook to handle profile loading/state
  const { 
    profile, 
    loading, 
    error, 
    refreshProfile 
  } = useProfileManager({
    loadOnFocus: true, // Automatically reload when screen comes into focus
    autoLoad: true     // Automatically load when component mounts
  });

  /**
   * @function togglePause
   * @description Pauses or resumes a video when the user taps on it.
   * @param {string} id - Video ID
   */
  const togglePause = (id) => {
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!isFocused) {
      // Pause all videos when screen is not focused
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    }
  }, [isFocused]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
      signOut(); 
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  /**
   * @function onIndexChanged
   * @description Handles changes in the video swiper index.
   * @param {number} index - The index of the newly active video.
   */
  const onIndexChanged = (index) => {
    setCurrentIndex(index);
    
    if (!profile?.videos || profile.videos.length === 0) return;
    
    // Pause all videos except the current one
    profile.videos.forEach((_, videoIndex) => {
      const videoId = `video-${videoIndex}`;
      if (videoIndex !== index && videoRefs.current[videoId]?.pauseAsync) {
        videoRefs.current[videoId].pauseAsync();
      }
    });
    
    // Play the current video if it's not manually paused
    const currentVideoId = `video-${index}`;
    if (!pausedStatus[currentVideoId] && videoRefs.current[currentVideoId]?.playAsync) {
      videoRefs.current[currentVideoId].playAsync();
    }
  };

  // Loading state
  if (loading && !profile) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Error state
  if (error && !profile) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refreshProfile} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
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
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 30 }]}>
        {/* Video Swiper */}
        <View style={styles.videoContainer}>
          {profile?.videos && profile.videos.length > 0 ? (
            <Swiper
              ref={swiperRef}
              style={styles.swiper}
              showsPagination={true}
              loop={false}
              onIndexChanged={onIndexChanged}
              dotStyle={styles.dot}
              activeDotStyle={styles.activeDot}
              paginationStyle={styles.pagination}
              removeClippedSubviews={false}
              scrollEnabled={true}
              showsButtons={false}
              width={width}
            >
              {profile.videos.map((videoUrl, index) => (
                <View key={`slide-${index}`} style={styles.slide}>
                  <TouchableOpacity 
                    style={styles.videoWrapper} 
                    onPress={() => togglePause(`video-${index}`)}
                    activeOpacity={0.9}
                  >
                    <Video
                      ref={(ref) => { videoRefs.current[`video-${index}`] = ref; }}
                      source={{ uri: videoUrl }}
                      style={styles.video}
                      resizeMode="cover"
                      isLooping
                      shouldPlay={!pausedStatus[`video-${index}`] && isFocused && currentIndex === index}
                      isMuted={false}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </Swiper>
          ) : (
            <View style={styles.noVideosContainer}>
              <Ionicons name="videocam-off" size={50} color={theme.text} />
              <Text style={[styles.noVideosText, { color: theme.text }]}>No videos available</Text>
            </View>
          )}
        </View>

        <View style={styles.usernameSection}>
          <Ionicons name="person-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.username, { color: theme.text }]}>@{profile?.username || 'musician'}</Text>
        </View>

        {/* Stars/Rating only if we have a rating */}
        {profile?.rating && (
          <View style={styles.stars}>
            {[...Array(5)].map((_, i) => (
              <FontAwesome 
                key={i} 
                name={i < profile.rating ? "star" : "star-o"} 
                size={SIZES.iconSmall || 16} 
                color="gold" 
              />
            ))}
          </View>
        )}

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.infoItem}>
            <Ionicons name="information-circle-outline" size={SIZES.icon} color={theme.text} />
            <Text style={[styles.infoText, { color: theme.text }]}>{profile.bio}</Text>
          </View>
        )}

        {/* Instruments */}
        {profile?.instruments && Object.keys(profile.instruments).length > 0 && (
          <View style={styles.infoItem}>
            <Ionicons name="musical-notes-outline" size={SIZES.icon} color={theme.text} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {Object.entries(profile.instruments)
                .map(([instrument, level]) => `${instrument} (${level})`)
                .join(', ')}
            </Text>
          </View>
        )}

        {/* Genres */}
        {profile?.genres && profile.genres.length > 0 && (
          <View style={styles.infoItem}>
            <Ionicons name="musical-note-outline" size={SIZES.icon} color={theme.text} />
            <Text style={[styles.infoText, { color: theme.text }]}>
              {profile.genres.join(', ')}
            </Text>
          </View>
        )}

        {/* Location */}
        {profile?.address && (
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={SIZES.icon} color={theme.text} />
            <Text style={[styles.infoText, { color: theme.text }]}>{profile.address}</Text>
          </View>
        )}

        {/* Social Links */}
        {profile?.social_links && (
          <View style={styles.infoItem}>
            <Ionicons name="link-outline" size={SIZES.icon} color={theme.text} />
            <Text style={[styles.infoText, { color: theme.text }]}>{profile.social_links}</Text>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={SIZES.icon} color="#ff6ec4" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
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
    flex: 1,
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
  // Loading and error states
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff6ec4',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noVideosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: SIZES.radius,
  },
  noVideosText: {
    marginTop: 10,
    fontSize: 16,
  },
  // Logout button styles
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'rgba(255, 110, 196, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff6ec4',
  },
  logoutText: {
    color: '#ff6ec4',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
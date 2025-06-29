/**
 * @module MusicianProfileScreen
 * Profile screen for viewing other users - Tinder-like music collaboration app
 * Shows static profile with single video, info, and message button
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video } from 'expo-av';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { fetchUserProfile } from '../../services/profileService';
import { handleError } from '../../utils/errors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * @function MusicianProfileScreen
 * @description Static profile screen for viewing other musicians
 * @returns {JSX.Element}
 */
const MusicianProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const insets = useSafeAreaInsets();

  // Get user data from navigation params
  const { userId, username } = route.params || {};

  // State management
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  /**
   * Load musician profile data
   */
  const loadMusicianProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🎯 Loading musician profile: ${username || userId}`);
      
      // Determine how to fetch the profile
      const field = username ? 'username' : 'id';
      const value = username || userId;
      
      const profileData = await fetchUserProfile(field, value);
      
      if (profileData) {
        setProfile(profileData);
        console.log(`✅ Musician profile loaded: ${profileData.username}`);
      } else {
        setError('Musician not found');
      }
    } catch (err) {
      console.error('❌ Error loading musician profile:', err);
      setError(handleError(err, 'MusicianProfileScreen/loadMusicianProfile') || 'Failed to load musician');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format instruments for display - FIX THE 0-5 NUMBERS ISSUE
   */
  const formatInstruments = () => {
    if (!profile?.instruments) return 'Music enthusiast';
    
    // Handle different instrument data formats
    if (Array.isArray(profile.instruments)) {
      return profile.instruments
        .filter(instrument => instrument && instrument !== null && instrument !== '')
        .join(', ') || 'Music enthusiast';
    }
    
    if (typeof profile.instruments === 'object') {
      const instrumentList = Object.entries(profile.instruments)
        .filter(([key, value]) => value && value !== null && value !== '')
        .map(([instrument, level]) => `${instrument} (${level})`)
        .join(', ');
      
      return instrumentList || 'Music enthusiast';
    }
    
    if (typeof profile.instruments === 'string') {
      return profile.instruments;
    }
    
    return 'Music enthusiast';
  };

  /**
   * Handle message button press
   */
  const handleMessage = () => {
    Alert.alert(
      'Message',
      `Send a message to ${profile?.username || 'this musician'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Message',
          onPress: () => {
            // TODO: Navigate to messaging screen or implement messaging
            console.log(`💬 Opening message with ${profile?.username}`);
            Alert.alert('Coming Soon', 'Messaging feature will be available soon!');
          }
        }
      ]
    );
  };

  /**
   * Render star rating
   */
  const renderStarRating = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating || 0);
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= fullStars ? 'star' : 'star-outline'}
          size={16}
          color="#FFD700"
          style={styles.star}
        />
      );
    }
    
    return <View style={styles.starsContainer}>{stars}</View>;
  };

  // Load profile on mount
  useEffect(() => {
    if (userId || username) {
      loadMusicianProfile();
    } else {
      setError('No musician specified');
      setLoading(false);
    }
  }, [userId, username]);

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={{ width: 28 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6ec4" />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={{ width: 28 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMusicianProfile}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // MAIN MUSICIAN PROFILE UI
  // ============================================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          @{profile?.username || 'Profile'}
        </Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={28} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Video Player - Single static video */}
        <View style={styles.videoContainer}>
          {profile?.videos && profile.videos.length > 0 ? (
            <Video
              source={{ uri: profile.videos[0] }}
              style={styles.video}
              useNativeControls
              resizeMode="cover"
              isLooping
              shouldPlay={false} // Don't auto-play
              onLoad={() => setVideoLoaded(true)}
              onError={(error) => {
                console.error('Video load error:', error);
                setVideoLoaded(false);
              }}
            />
          ) : (
            <View style={[styles.videoPlaceholder, { backgroundColor: theme.cardBackground }]}>
              <Ionicons name="musical-notes" size={48} color={theme.textSecondary} />
              <Text style={[styles.videoPlaceholderText, { color: theme.textSecondary }]}>
                No video available
              </Text>
            </View>
          )}
          
          {/* Video loading indicator */}
          {!videoLoaded && profile?.videos && profile.videos.length > 0 && (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color="#ff6ec4" />
            </View>
          )}
        </View>

        {/* Profile Information */}
        <View style={styles.profileInfo}>
          {/* Username and Rating */}
          <View style={styles.userHeader}>
            <Text style={[styles.username, { color: theme.text }]}>
              @{profile?.username}
            </Text>
            {renderStarRating(profile?.rating)}
          </View>

          {/* Bio */}
          {profile?.bio && (
            <Text style={[styles.bio, { color: theme.textSecondary }]}>
              {profile.bio}
            </Text>
          )}

          {/* Instruments */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="musical-notes" size={20} color="#ff6ec4" />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Instruments</Text>
            </View>
            <Text style={[styles.instrumentsText, { color: theme.textSecondary }]}>
              {formatInstruments()}
            </Text>
          </View>

          {/* Location */}
          {profile?.location && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={20} color="#ff6ec4" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
              </View>
              <Text style={[styles.locationText, { color: theme.textSecondary }]}>
                {profile.location}
              </Text>
            </View>
          )}

          {/* Social Link */}
          {profile?.socialLink && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="link-outline" size={20} color="#ff6ec4" />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Social</Text>
              </View>
              <Text style={[styles.socialText, { color: '#ff6ec4' }]}>
                {profile.socialLink}
              </Text>
            </View>
          )}

          {/* Message Button */}
          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={20} color="white" />
            <Text style={styles.messageButtonText}>Send Message</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
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
    fontSize: 16,
    marginTop: 15,
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
  videoContainer: {
    height: 400,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#111',
    width: screenWidth - 40,
    alignSelf: 'center',
  },
  video: {
    width: screenWidth - 40,
    height: 400,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  videoPlaceholder: {
    width: screenWidth - 40,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  videoPlaceholderText: {
    marginTop: 10,
    fontSize: 16,
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  profileInfo: {
    padding: 20,
    paddingTop: 0,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  username: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginLeft: 2,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  instrumentsText: {
    fontSize: 16,
    lineHeight: 24,
  },
  locationText: {
    fontSize: 16,
    lineHeight: 24,
  },
  socialText: {
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
  messageButton: {
    backgroundColor: '#ff6ec4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 28,
    marginTop: 16,
    shadowColor: '#ff6ec4',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default MusicianProfileScreen;
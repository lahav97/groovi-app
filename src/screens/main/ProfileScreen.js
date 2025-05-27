/**
 * @module ProfileScreen
 * LIGHTNING-FAST profile screen - Clean, modular, and maintainable
 * Uses custom hooks and components for better organization
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../../styles/theme';
import { useProfileData } from '../../hooks/useProfileData';
import { useVideoCache } from '../../hooks/useVideoCache';
import ProfileVideoSwiper from '../../components/profile/ProfileVideoSwiper';
import ProfileInfo from '../../components/profile/ProfileInfo';

/**
 * @function ProfileScreen
 * @description Clean, modular ProfileScreen with separated concerns
 * @returns {JSX.Element}
 */
const ProfileScreen = () => {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

  // Profile data management
  const {
    profile,
    loading,
    error,
    refreshing,
    loggingOut,
    isBackgroundRefreshing,
    handleLogout,
    onRefresh,
    loadProfileInstantly,
    formatInstruments,
  } = useProfileData();

  // Video caching and management
  const {
    videoObjects,
    videoStates,
    onIndexChanged,
    togglePause,
    shouldVideoPlay,
    handleVideoLoadStart,
    handleVideoReadyForDisplay,
    handleVideoLoadError,
    setVideoRef,
    clearVideoCache,
  } = useVideoCache(profile?.videos);

  // Clear video cache on logout
  React.useEffect(() => {
    if (loggingOut) {
      clearVideoCache();
    }
  }, [loggingOut, clearVideoCache]);

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================
  if (loading && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6ec4" />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading your profile...
          </Text>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================
  if (error && !profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>Failed to load profile</Text>
          <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfileInstantly}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomNav}>
          <BottomNavigation />
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // MAIN PROFILE UI
  // ============================================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Background refresh indicator */}
      {isBackgroundRefreshing && (
        <View style={styles.backgroundRefreshIndicator}>
          <ActivityIndicator size="small" color="#ff6ec4" />
        </View>
      )}

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
            colors={['#ff6ec4']}
          />
        }
      >
        {/* Video Swiper Component */}
        <ProfileVideoSwiper
          videoObjects={videoObjects}
          onIndexChanged={onIndexChanged}
          togglePause={togglePause}
          shouldVideoPlay={shouldVideoPlay}
          handleVideoLoadStart={handleVideoLoadStart}
          handleVideoReadyForDisplay={handleVideoReadyForDisplay}
          handleVideoLoadError={handleVideoLoadError}
          setVideoRef={setVideoRef}
          videoStates={videoStates}
        />

        {/* Profile Information Component */}
        <ProfileInfo
          profile={profile}
          formatInstruments={formatInstruments}
          handleLogout={handleLogout}
          loggingOut={loggingOut}
        />
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <BottomNavigation />
      </View>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES - Clean and minimal
// ============================================================================
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
  backgroundRefreshIndicator: {
    position: 'absolute',
    top: 55,
    right: 25,
    zIndex: 15,
    backgroundColor: 'rgba(255, 110, 196, 0.1)',
    borderRadius: 12,
    padding: 4,
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
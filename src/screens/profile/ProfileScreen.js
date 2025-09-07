/**
 * FIXED ProfileScreen - Clean loading without skeleton conflicts
 * Checks cache first, shows clean loading only when needed
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
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT, FONTS } from '../../styles/theme';
import { useProfileData } from '../../hooks/useProfileData';
import { useVideoCache } from '../../hooks/useVideoCache';
import ProfileVideoSwiper from '../../components/profile/ProfileVideoSwiper';
import ProfileInfo from '../../components/profile/ProfileInfo';
import { handleError } from '../../utils/errors';
import BackgroundDataService from '../../services/BackgroundDataService';
import { getProfileCache } from '../../utils/cacheManager';
import { useAuth } from '../../context/AuthContext';

const ProfileScreen = () => {
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
    const { user } = useAuth();

    // Smart loading state management
    const [smartLoading, setSmartLoading] = useState(true);
    const [cachedProfile, setCachedProfile] = useState(null);
    const [useHookFallback, setUseHookFallback] = useState(false);

    // Profile data management (only used as fallback)
    const {
        profile: hookProfile,
        loading: hookLoading,
        error: hookError,
        refreshing,
        loggingOut,
        isBackgroundRefreshing,
        handleLogout,
        onRefresh,
        loadProfileInstantly,
        formatInstruments,
    } = useProfileData();

    // Determine which profile data to use
    const profile = cachedProfile || hookProfile;
    const loading = useHookFallback ? hookLoading : smartLoading;
    const error = useHookFallback ? hookError : null;

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

    // Smart profile loading on mount
    useEffect(() => {
        const loadProfileSmart = async () => {
            try {
                // Check if BackgroundDataService already has profile
                const serviceStatus = BackgroundDataService.getSeparatedSystemStatus();

                if (serviceStatus.profile.loaded) {
                    // Profile already loaded by BackgroundDataService
                    const cached = await getProfileCache(user?.email);
                    if (cached) {
                        setCachedProfile(cached);
                        setSmartLoading(false);
                        console.log('Profile loaded instantly from cache');
                        return;
                    }
                }

                // Check direct cache
                const directCache = await getProfileCache(user?.email);
                if (directCache) {
                    setCachedProfile(directCache);
                    setSmartLoading(false);
                    console.log('Profile loaded from direct cache');
                    return;
                }

                // No cache available, fall back to hook loading
                console.log('No cached profile, using hook fallback');
                setUseHookFallback(true);
                setSmartLoading(false);

            } catch (error) {
                console.error('Smart profile loading failed:', error);
                setUseHookFallback(true);
                setSmartLoading(false);
            }
        };

        if (user?.email) {
            loadProfileSmart();
        }
    }, [user?.email]);

    // Clear video cache on logout
    useEffect(() => {
        if (loggingOut) {
            clearVideoCache();
        }
    }, [loggingOut, clearVideoCache]);

    // Handle refresh - clear cache and reload
    const handleRefresh = async () => {
        setCachedProfile(null);
        setSmartLoading(true);
        setUseHookFallback(false);

        // Trigger background service refresh
        await BackgroundDataService.forceRefreshProfileOnly();

        // Reload smart
        const cached = await getProfileCache(user?.email);
        if (cached) {
            setCachedProfile(cached);
        } else {
            setUseHookFallback(true);
        }
        setSmartLoading(false);
    };

    // ============================================================================
    // RENDER LOADING STATE (Clean, no skeleton)
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
                    <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
                        {handleError(error, 'ProfileScreen')}
                    </Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
    // MAIN PROFILE UI (No skeleton, clean transition)
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
                        onRefresh={useHookFallback ? onRefresh : handleRefresh}
                        tintColor={theme.text}
                        colors={['#ff6ec4']}
                    />
                }
            >
                {/* Video Swiper Component */}
                {profile?.videos && profile.videos.length > 0 && (
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
                )}

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
// STYLES (unchanged)
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
        fontFamily: FONTS.rubik.medium,
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
        fontFamily: FONTS.rubik.bold,
        marginBottom: 8,
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 14,
        fontFamily: FONTS.rubik.regular,
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
        fontFamily: FONTS.rubik.bold,
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
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
import { useNavigation, useIsFocused } from '@react-navigation/native';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { COLORS, SIZES, LAYOUT, FONTS } from '../../styles/theme';
import { useProfileData } from '../../hooks/useProfileData';
import { useVideoCache } from '../../hooks/useVideoCache';
import ProfileVideoSwiper from '../../components/profile/ProfileVideoSwiper';
import ProfileInfo from '../../components/profile/ProfileInfo';
import { handleError } from '../../utils/errors';

const ProfileScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;

    // Just stabilize videos, keep everything else the same
    const [stableVideos, setStableVideos] = useState([]);

    // Profile data management
    const {
        profile,
        loading,
        error,
        refreshing,
        isBackgroundRefreshing,
        onRefresh,
        loadProfileInstantly,
        formatInstruments,
    } = useProfileData();

    // Only stabilize videos to prevent cache reinit
    useEffect(() => {
        if (profile?.videos && Array.isArray(profile.videos) && profile.videos.length > 0) {
            const newVideos = profile.videos.filter(v => v && v !== '');
            if (JSON.stringify(newVideos) !== JSON.stringify(stableVideos)) {
                setStableVideos(newVideos);
            }
        } else {
            setStableVideos([]);
        }
    }, [profile?.videos]);

    // Video caching and management - USE STABLE VIDEOS
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
    } = useVideoCache(stableVideos); // Only change: use stableVideos

    useEffect(() => {
        if (isFocused && stableVideos.length > 0) {
            console.log('📄 ProfileScreen focused - checking video state');
            const timer = setTimeout(() => {
                // Force videos to resume when screen becomes focused
                if (videoObjects && videoObjects.length > 0) {
                    console.log('📹 Attempting to resume videos on focus');
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isFocused, stableVideos.length, videoObjects]);

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
    // RENDER ERROR STATE (your original)
    // ============================================================================
    if (error && !profile) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: theme.text }]}>Failed to load profile</Text>
                    <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
                        {handleError(error, 'ProfileScreen')}
                    </Text>
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
    // MAIN PROFILE UI (updated to navigate to settings)
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
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
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
                {/* Video Swiper Component - RENDER ALWAYS like your original */}
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

                {/* Profile Information Component - removed logout props */}
                <ProfileInfo
                    profile={profile}
                    formatInstruments={formatInstruments}
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
// STYLES (your original)
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
/**
 * @module MusicianProfileScreen
 * Profile screen for viewing other users - Tinder-like music collaboration app
 * Shows profile with ProfileVideoSwiper component (same style as ProfileScreen)
 * Uses smart video caching and loading states for professional UX
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, LAYOUT, FONTS, TEXT_UTILS } from '../../styles/theme';
import { fetchUserProfile } from '../../services/profileService';
import { handleError } from '../../utils/errors';
import { useVideoCache } from '../../hooks/useVideoCache';
import ProfileVideoSwiper from '../../components/profile/ProfileVideoSwiper';
import { createLogger } from '../../utils/Logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Logger instance for this screen
const logger = createLogger('MusicianProfile');

// Helper function for conversation ID generation (same as MatchScreen)
const getConversationId = (myEmail = '', otherUserName = '') =>
    `${myEmail || 'unknown'}|${otherUserName || 'unknown'}`;

/**
 * @function MusicianProfileScreen
 * @description Profile screen for viewing other musicians with ProfileVideoSwiper
 * @returns {JSX.Element}
 */
const MusicianProfileScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    // Get user data from navigation params
    const { userId, username } = route.params || {};

    // Current user email for chat conversation ID
    const currentUserEmail = useMemo(() =>
            user?.email || user?.username || 'guest@groovi.app',
        [user?.email, user?.username]
    );

    // State management
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Video caching and management (same as ProfileScreen)
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

    /**
     * Load musician profile data
     */
    const loadMusicianProfile = async () => {
        try {
            setLoading(true);
            setError(null);
            logger.time('profile_load');

            logger.info(`Loading musician profile: ${username || userId}`);

            const field = username ? 'username' : 'id';
            const value = username || userId;

            const profileData = await fetchUserProfile(field, value);

            if (profileData) {
                setProfile(profileData);
                logger.timeEnd('profile_load');
                logger.info(`✅ Profile loaded successfully: ${profileData.username}`);
            } else {
                setError('Musician not found');
                logger.warn('Profile not found', { field, value });
            }
        } catch (err) {
            logger.timeEnd('profile_load');
            logger.error('Failed to load musician profile', { error: err.message, userId, username });
            setError(handleError(err, 'MusicianProfileScreen/loadMusicianProfile') || 'Failed to load musician');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Format instruments for display with proper data handling
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
     * Handle message button press - Navigate directly to chat
     */
    const handleMessage = () => {
        const theirUsername = profile?.username;

        if (!theirUsername) {
            Alert.alert('Error', 'Unable to start chat. Please try again.');
            logger.warn('Message attempt failed - no username', { profile: profile?.id });
            return;
        }

        const conversationId = getConversationId(currentUserEmail, theirUsername);
        logger.info(`Navigating to chat with user: ${theirUsername}`, { conversationId });

        navigation.navigate('ChatScreen', {
            userName: theirUsername,
            conversationId,
            isNewConversation: true,
        });
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

    // Clear video cache on unmount
    useEffect(() => {
        return () => {
            clearVideoCache();
        };
    }, [clearVideoCache]);

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
                {/* Professional Video Swiper Component - Same as ProfileScreen */}
                <View style={styles.videoSwiperContainer}>
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
                </View>

                {/* Profile Information */}
                <View style={styles.profileInfo}>
                    {/* Username, Rating and Message Button Row */}
                    <View style={styles.userHeaderWithButton}>
                        <View style={styles.userInfo}>
                            <Text style={[
                                styles.username,
                                { color: theme.text },
                                TEXT_UTILS.getBoldTextStyle(`@${profile?.username}`)
                            ]}>
                                @{profile?.username}
                            </Text>
                            {renderStarRating(profile?.rating)}
                        </View>
                        <TouchableOpacity style={styles.messageButtonCompact} onPress={handleMessage}>
                            <LinearGradient
                                colors={COLORS.primaryGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.messageButtonGradient}
                            >
                                <Ionicons name="paper-plane" size={18} color="white" />
                                <Text style={styles.messageButtonCompactText}>Message</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Bio */}
                    {profile?.bio && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="information-circle" size={20} color="#ff6ec4" />
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Bio</Text>
                            </View>
                            <Text style={[
                                styles.bio,
                                { color: theme.textSecondary },
                                TEXT_UTILS.getTextStyle(profile.bio)
                            ]}>
                                {profile.bio}
                            </Text>
                        </View>
                    )}

                    {/* Instruments */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="musical-notes" size={20} color="#ff6ec4" />
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Instruments</Text>
                        </View>
                        <Text style={[
                            styles.instrumentsText,
                            { color: theme.textSecondary },
                            TEXT_UTILS.getTextStyle(formatInstruments())
                        ]}>
                            {formatInstruments()}
                        </Text>
                    </View>

                    {/* Location - Always show with fallbacks like ProfileInfo */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="location-outline" size={20} color="#ff6ec4" />
                            <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
                        </View>
                        <Text style={[
                            styles.locationText,
                            { color: theme.textSecondary },
                            TEXT_UTILS.getTextStyle(profile?.address || profile?.location || 'Location not specified')
                        ]}>
                            {profile?.address || profile?.location || 'Location not specified'}
                        </Text>
                    </View>

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
        fontFamily: FONTS.rubik.bold,
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
        fontFamily: FONTS.rubik.medium,
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
    // Video Swiper Container - Same style as ProfileScreen
    videoSwiperContainer: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 20,
        borderRadius: 12,
        overflow: 'hidden',
        height: 400,
        backgroundColor: '#111',
    },
    profileInfo: {
        padding: 20,
        paddingTop: 0,
    },
    // New Header with Message Button
    userHeaderWithButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    userInfo: {
        flex: 1,
        marginRight: 16,
    },
    username: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    messageButtonCompact: {
        borderRadius: 20,
        shadowColor: '#ff6ec4',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
        overflow: 'hidden',
    },
    messageButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    messageButtonCompactText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
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
});

export default MusicianProfileScreen;
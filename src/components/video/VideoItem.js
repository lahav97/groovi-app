import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableWithoutFeedback,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    useColorScheme,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, LAYOUT } from '../../styles/theme';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { createLogger } from '../../utils/Logger';

const logger = createLogger('VideoItem');
const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Global Video Manager to handle play/pause across the app
class GlobalVideoManager {
    constructor() {
        this.currentActiveVideo = null;
        this.allVideoRefs = new Map();
        this.pausedVideos = new Set();
    }

    registerVideo(videoRef, videoId) {
        this.allVideoRefs.set(videoId, videoRef);
    }

    unregisterVideo(videoId) {
        this.allVideoRefs.delete(videoId);
        this.pausedVideos.delete(videoId);
    }

    async setActiveVideo(videoRef, videoId, isManualPlay = false) {
        try {
            if (isManualPlay) {
                this.pausedVideos.delete(videoId);
            }

            for (const [id, ref] of this.allVideoRefs) {
                if (id !== videoId && ref.current) {
                    try {
                        await ref.current.pauseAsync();
                    } catch (error) {
                        // Silent fail
                    }
                }
            }

            this.currentActiveVideo = videoId;

            if (videoRef.current) {
                try {
                    await videoRef.current.playAsync();
                    logger.info(`▶️ Video playing: ${videoId}`);
                } catch (error) {
                    logger.warn('⚠️ Failed to play video:', error);
                }
            }
        } catch (error) {
            logger.error('❌ Error setting active video:', error);
        }
    }

    async pauseVideo(videoId) {
        try {
            const ref = this.allVideoRefs.get(videoId);
            if (ref && ref.current) {
                await ref.current.pauseAsync();
                this.pausedVideos.add(videoId);
                if (this.currentActiveVideo === videoId) {
                    this.currentActiveVideo = null;
                }
                logger.info(`⏸️ Video paused: ${videoId}`);
            }
        } catch (error) {
            logger.error('❌ Error pausing video:', error);
        }
    }

    async pauseAllVideos() {
        const pausePromises = [];
        for (const [id, ref] of this.allVideoRefs) {
            if (ref.current) {
                pausePromises.push(ref.current.pauseAsync().catch(() => {}));
            }
        }
        await Promise.all(pausePromises);
        this.currentActiveVideo = null;
    }

    isActive(videoId) {
        return this.currentActiveVideo === videoId;
    }

    isManuallyPaused(videoId) {
        return this.pausedVideos.has(videoId);
    }
}

const globalVideoManager = new GlobalVideoManager();

// Simplified Profile Picture Component
const ProfilePictureComponent = ({ item, size = 32 }) => {
    const getUserInitials = useCallback(() => {
        const name = item.user || item.username || 'Unknown User';
        if (name === 'Unknown User') return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }, [item.user, item.username]);

    if (item.profilePicture && item.profilePicture.startsWith('http')) {
        return (
            <Image
                source={{ uri: item.profilePicture }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    marginRight: 12
                }}
                onError={() => {
                    logger.warn(`❌ Profile picture failed to load: ${item.profilePicture}`);
                }}
            />
        );
    }

    // Fallback to gradient with initials
    return (
        <LinearGradient
            colors={['#ff6ec4', '#a855f7', '#3b82f6']}
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                marginRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: size * 0.44 }}>
                {getUserInitials()}
            </Text>
        </LinearGradient>
    );
};

const VideoItem = memo(({ item, isVisible, height, shouldCache = false }) => {
    const videoRef = useRef(null);
    const isFocused = useIsFocused();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // Video state management
    const [userPaused, setUserPaused] = useState(false);
    const [showPlayIcon, setShowPlayIcon] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [localVideoUri, setLocalVideoUri] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);

    // Refs
    const retryCountRef = useRef(0);
    const componentMountedRef = useRef(true);
    const cacheAttemptedRef = useRef(false);
    const stableVideoSourceRef = useRef(null);

    const videoId = useRef(`video-${item.id || 'unknown'}-${Date.now()}`).current;
    const colorScheme = useColorScheme();
    const COLOR = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
    const videoSource = stableVideoSourceRef.current || localVideoUri || item.videoUrl;

    const userInfoBottom = useMemo(() => {
        // Simple calculation: navigation bar height + safe area + some padding
        const navBarHeight =  60;
        const extraPadding = 0; // Additional padding to ensure visibility

        return navBarHeight + extraPadding;
    }, [insets.bottom]);

    // Helper functions
    const getUserDisplayName = useCallback(() => {
        return item.user || item.username || 'Unknown User';
    }, [item.user, item.username]);

    const getInstrumentsText = useCallback(() => {
        if (Array.isArray(item.instruments)) {
            return item.instruments.join(', ');
        }
        return item.description || item.instruments || 'Music Video';
    }, [item.instruments, item.description]);

    const handleUserPress = useCallback(() => {
        try {
            const username = getUserDisplayName();
            logger.info('👤 User profile pressed', { username });

            if (!username || username === 'Unknown User') {
                logger.warn('No valid username available for profile navigation');
                return;
            }

            navigation.navigate('MusicianProfile', {
                username: username,
                ...(item.user_id && { userId: item.user_id }),
                ...(item.id && { videoId: item.id })
            });
        } catch (error) {
            logger.error('Failed to navigate to musician profile', {
                error: error.message,
                username: getUserDisplayName()
            });
        }
    }, [getUserDisplayName, navigation, item.user_id, item.id]);

    // Register with video manager
    useEffect(() => {
        globalVideoManager.registerVideo(videoRef, videoId);
        return () => {
            globalVideoManager.unregisterVideo(videoId);
        };
    }, [videoId]);

    const updatePlaybackState = useCallback(async () => {
        if (!componentMountedRef.current || !videoLoaded) return;

        const shouldPlay = isVisible && isFocused && !userPaused;
        const isCurrentlyActive = globalVideoManager.isActive(videoId);

        if (shouldPlay && !isCurrentlyActive) {
            await globalVideoManager.setActiveVideo(videoRef, videoId, false);
        } else if (!shouldPlay && isCurrentlyActive) {
            if (videoRef.current) {
                try {
                    await videoRef.current.pauseAsync();
                } catch (error) {
                    // Silent fail
                }
            }
        }
    }, [isVisible, isFocused, userPaused, videoLoaded, videoId]);

    useEffect(() => {
        const timeoutId = setTimeout(updatePlaybackState, 100);
        return () => clearTimeout(timeoutId);
    }, [updatePlaybackState]);

    useEffect(() => {
        if (!isFocused) {
            globalVideoManager.pauseAllVideos();
        }
    }, [isFocused]);

    const handleTogglePlayback = useCallback(async () => {
        if (!componentMountedRef.current || !videoLoaded) return;
        const newUserPaused = !userPaused;
        setUserPaused(newUserPaused);
        setShowPlayIcon(true);
        if (newUserPaused) {
            await globalVideoManager.pauseVideo(videoId);
        } else {
            await globalVideoManager.setActiveVideo(videoRef, videoId, true);
        }
    }, [userPaused, videoLoaded, videoId]);

    const handleVideoLoad = useCallback(() => {
        if (!componentMountedRef.current) return;
        setVideoLoaded(true);
        setIsLoading(false);
        setHasError(false);
        retryCountRef.current = 0;
        setTimeout(updatePlaybackState, 50);
    }, [updatePlaybackState]);

    // Component mount/unmount
    useEffect(() => {
        componentMountedRef.current = true;
        return () => {
            componentMountedRef.current = false;
            if (videoRef.current) {
                videoRef.current.pauseAsync().catch(() => {});
                videoRef.current.unloadAsync().catch(() => {});
            }
        };
    }, [videoId]);

    // Validate video URL
    if (!item.videoUrl || typeof item.videoUrl !== 'string' || !item.videoUrl.startsWith('http')) {
        return (
            <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
                <View style={styles.centerOverlay}>
                    <Ionicons name="videocam-off" size={60} color="#666" />
                    <Text style={styles.errorText}>Invalid video</Text>
                </View>
                <View style={[styles.bottomLeftContainer, { bottom: userInfoBottom }]}>
                    <View style={styles.userInfoContainer}>
                        <TouchableOpacity onPress={handleUserPress} style={styles.usernameRow}>
                            <ProfilePictureComponent item={item} size={32} />
                            <Text style={styles.username} numberOfLines={1}>@{getUserDisplayName()}</Text>
                        </TouchableOpacity>
                        <View style={styles.instrumentsRow}>
                            <Ionicons name="musical-notes" size={16} color="white" style={styles.musicIcon} />
                            <Text style={styles.instruments} numberOfLines={2}>{getInstrumentsText()}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <TouchableWithoutFeedback onPress={handleTogglePlayback}>
            <View style={[styles.videoContainer, { backgroundColor: COLOR.background, height }]}>
                <Video
                    ref={videoRef}
                    source={{ uri: videoSource }}
                    style={styles.videoPlayer}
                    resizeMode="cover"
                    isLooping={true}
                    isMuted={false}
                    onLoad={handleVideoLoad}
                    useNativeControls={false}
                    ignoreSilentSwitch="ignore"
                />

                {/* Play/pause icon */}
                {showPlayIcon && (
                    <View style={styles.centerOverlay}>
                        <View style={styles.playIconBackground}>
                            <Ionicons
                                name={userPaused ? 'play' : 'pause'}
                                size={50}
                                color="white"
                                style={styles.playIcon}
                            />
                        </View>
                    </View>
                )}

                {/* Loading indicator */}
                {isLoading && !isPlaying && !showPlayIcon && (
                    <View style={styles.centerOverlay}>
                        <ActivityIndicator size="large" color="white" />
                    </View>
                )}

                <View style={[styles.bottomLeftContainer, { bottom: userInfoBottom }]}>
                    <View style={styles.userInfoContainer}>
                        <TouchableOpacity onPress={handleUserPress} activeOpacity={0.7} style={styles.usernameRow}>
                            <ProfilePictureComponent item={item} size={32} />
                            <Text style={styles.username} numberOfLines={1}>
                                @{getUserDisplayName()}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.instrumentsRow}>
                            <Ionicons
                                name="musical-notes"
                                size={16}
                                color="white"
                                style={styles.musicIcon}
                            />
                            <Text style={styles.instruments} numberOfLines={2}>
                                {getInstrumentsText()}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableWithoutFeedback>
    );
});

VideoItem.displayName = 'VideoItem';

// Updated styles with proper positioning
const styles = StyleSheet.create({
    videoContainer: {
        width: width,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    videoPlayer: {
        width: width,
        height: SCREEN_HEIGHT,
    },
    centerOverlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -35 }, { translateY: -35 }],
        zIndex: 10,
        alignItems: 'center',
    },
    playIconBackground: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: {
        alignSelf: 'center',
    },
    errorText: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
    },

    bottomLeftContainer: {
        position: 'absolute',
        left: 0,
        right: 80,
        height: 90,
        zIndex: 5,
    },
    userInfoContainer: {
        position: 'absolute',
        left: 20,
        right: 20,
        height: 90,
        justifyContent: 'flex-end',
    },

    // Username row with profile picture
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        marginBottom: 8,
    },

    // Profile picture styles
    profilePicture: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
    },

    profilePictureImage: {
        marginRight: 12,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
    },

    profileInitials: {
        color: 'white',
        fontWeight: 'bold',
    },
    username: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },

    // Instruments row
    instrumentsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        height: 42,
        paddingTop: 2,
    },
    musicIcon: {
        marginRight: 8,
        marginTop: 2,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    instruments: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        lineHeight: 18,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
});

export default VideoItem;
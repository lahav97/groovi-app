import React, { useRef, useEffect, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    Text,
    StyleSheet,
    Dimensions,
    useColorScheme,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Swiper from 'react-native-swiper';
import { useIsFocused } from '@react-navigation/native';
import { COLORS, SIZES } from '../../styles/theme';
import AppMemoryManager from '../../utils/AppMemoryManager';
import { createLogger } from '../../utils/Logger';

const { width } = Dimensions.get('window');
const logger = createLogger('ProfileVideoSwiper');

/**
 * Focus-aware video swiper with cleanup coordination
 * Pauses/resumes videos based on screen focus instead of clearing cache
 */
const ProfileVideoSwiper = ({
                                videoObjects,
                                onIndexChanged,
                                togglePause,
                                shouldVideoPlay,
                                handleVideoLoadStart,
                                handleVideoReadyForDisplay,
                                handleVideoLoadError,
                                setVideoRef,
                                videoStates,
                            }) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
    const swiperRef = useRef(null);
    const isFocused = useIsFocused();

    // Track video refs for focus-aware pause/resume
    const componentVideoRefs = useRef({});
    const wasUnfocused = useRef(false);

    // Register with cleanup gate for coordinated cleanup
    useEffect(() => {
        const cleanupListener = (cleanupType) => {
            if (cleanupType === 'emergency_cleanup') {
                logger.info('🚨 Emergency cleanup - clearing video refs');
                handleEmergencyCleanup();
            } else if (cleanupType === 'routine_cleanup') {
                logger.debug('🧹 Routine cleanup - pausing all videos');
                pauseAllVideos('routine');
            }
        };

        AppMemoryManager.addNavigationListener(cleanupListener);

        return () => {
            AppMemoryManager.removeNavigationListener(cleanupListener);
            // Clean up video refs on unmount
            handleEmergencyCleanup();
        };
    }, []);

    // Focus-aware video control
    useEffect(() => {
        if (isFocused) {
            if (wasUnfocused.current) {
                logger.info('📱 ProfileVideoSwiper focused - resuming current video');
                resumeCurrentVideo();
                wasUnfocused.current = false;
            }
        } else {
            logger.info('📱 ProfileVideoSwiper unfocused - pausing all videos (no cache clear)');
            pauseAllVideos('unfocus');
            wasUnfocused.current = true;
        }
    }, [isFocused]);

    /**
     * Pause all videos without clearing cache
     */
    const pauseAllVideos = useCallback((reason) => {
        let pausedCount = 0;

        Object.entries(componentVideoRefs.current).forEach(([videoId, ref]) => {
            if (ref && ref.pauseAsync) {
                ref.pauseAsync().catch((error) => {
                    logger.warn('⚠️ Failed to pause video', {
                        videoId,
                        reason,
                        error: error.message
                    });
                });
                pausedCount++;
            }
        });

        logger.info('⏸️ Videos paused in ProfileVideoSwiper', {
            reason,
            pausedCount,
            preservedRefs: true
        });
    }, []);

    /**
     * Resume current video only (focus-aware)
     */
    const resumeCurrentVideo = useCallback(() => {
        if (videoObjects.length === 0) return;

        // Find current video based on swiper state
        const currentVideo = videoObjects[0]; // Default to first video
        if (!currentVideo) return;

        const ref = componentVideoRefs.current[currentVideo.id];
        if (ref && ref.playAsync && shouldVideoPlay(currentVideo.id, 0)) {
            ref.playAsync().catch((error) => {
                logger.warn('⚠️ Failed to resume current video', {
                    videoId: currentVideo.id,
                    error: error.message
                });
            });

            logger.info('▶️ Current video resumed on focus', {
                videoId: currentVideo.id
            });
        }
    }, [videoObjects, shouldVideoPlay]);

    /**
     * Emergency cleanup - clear all refs
     */
    const handleEmergencyCleanup = useCallback(() => {
        logger.info('🚨 Emergency cleanup in ProfileVideoSwiper');

        const refCount = Object.keys(componentVideoRefs.current).length;

        // Pause all videos first
        Object.values(componentVideoRefs.current).forEach(ref => {
            if (ref && ref.pauseAsync) {
                ref.pauseAsync().catch(() => {}); // Silent fail
            }
        });

        // Clear all refs
        componentVideoRefs.current = {};

        logger.info('✅ Emergency cleanup completed', {
            clearedRefs: refCount
        });
    }, []);

    /**
     * Enhanced video ref management with cleanup coordination
     */
    const handleVideoRef = useCallback((videoId, ref) => {
        // Store ref locally for focus management
        if (ref) {
            componentVideoRefs.current[videoId] = ref;
        } else {
            delete componentVideoRefs.current[videoId];
        }

        // Also update the parent hook
        setVideoRef(videoId, ref);

        logger.debug('🔹 Video ref updated in ProfileVideoSwiper', {
            videoId,
            hasRef: !!ref,
            totalRefs: Object.keys(componentVideoRefs.current).length
        });
    }, [setVideoRef]);

    /**
     * Enhanced index change with focus awareness
     */
    const handleIndexChanged = useCallback((index) => {
        logger.info('📱 Video swipe detected', {
            newIndex: index,
            isFocused,
            totalVideos: videoObjects.length
        });

        // Only handle video control if screen is focused
        if (isFocused) {
            onIndexChanged(index, videoObjects);
        } else {
            logger.debug('📱 Skipping video control - screen not focused');
        }
    }, [isFocused, onIndexChanged, videoObjects]);

    /**
     * Focus-aware video touch handling
     */
    const handleVideoTouch = useCallback((videoId) => {
        if (!isFocused) {
            logger.debug('📱 Video touch ignored - screen not focused');
            return;
        }

        logger.debug('👆 Video touched', { videoId, isFocused });
        togglePause(videoId);
    }, [isFocused, togglePause]);

    if (videoObjects.length === 0) {
        return (
            <View style={styles.noVideosContainer}>
                <Ionicons name="videocam-outline" size={60} color={theme.textSecondary} />
                <Text style={[styles.noVideosText, { color: theme.textSecondary }]}>
                    No videos uploaded yet
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.videoContainer}>
            <Swiper
                ref={swiperRef}
                style={styles.swiper}
                showsPagination={true}
                loop={false}
                onIndexChanged={handleIndexChanged}
                dotStyle={styles.dot}
                activeDotStyle={styles.activeDot}
                paginationStyle={styles.pagination}
                removeClippedSubviews={false} // Keep for caching
                loadMinimal={false} // Load all for better caching
                scrollEnabled={true}
                showsButtons={false}
                width={width}
            >
                {videoObjects.map((video, index) => (
                    <View key={video.id} style={styles.slide}>
                        <TouchableOpacity
                            style={styles.videoWrapper}
                            onPress={() => handleVideoTouch(video.id)}
                            activeOpacity={0.9}
                        >
                            {/* Focus-aware video component */}
                            <Video
                                ref={(ref) => handleVideoRef(video.id, ref)}
                                source={{ uri: video.uri }}
                                style={styles.video}
                                resizeMode="cover"
                                isLooping
                                shouldPlay={isFocused && shouldVideoPlay(video.id, index)}
                                isMuted={false}
                                onLoadStart={() => handleVideoLoadStart(video.id)}
                                onReadyForDisplay={() => handleVideoReadyForDisplay(video.id)}
                                onError={(error) => handleVideoLoadError(video.id, error)}
                            />

                            {/* Loading spinner overlay */}
                            {video.isLoading && (
                                <View style={styles.videoLoadingOverlay}>
                                    <View style={styles.tinySpinnerContainer}>
                                        <ActivityIndicator
                                            size="small"
                                            color="#ff6ec4"
                                            style={styles.tinySpinner}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Error state indicator */}
                            {videoStates[video.id] === 'error' && (
                                <View style={styles.videoErrorOverlay}>
                                    <Ionicons name="warning-outline" size={30} color="#ff6b6b" />
                                    <Text style={styles.videoErrorText}>Video unavailable</Text>
                                </View>
                            )}

                            {/* Focus indicator overlay */}
                            {!isFocused && (
                                <View style={styles.unfocusedOverlay}>
                                    <Ionicons name="pause-circle-outline" size={40} color="rgba(255,255,255,0.8)" />
                                    <Text style={styles.unfocusedText}>Paused</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                ))}
            </Swiper>
        </View>
    );
};

const styles = StyleSheet.create({
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
        position: 'relative',
    },
    video: {
        width: width - 40,
        height: 400,
        borderRadius: SIZES.radius,
        backgroundColor: '#111',
    },

    // Loading spinner overlay
    videoLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: SIZES.radius,
    },
    tinySpinnerContainer: {
        backgroundColor: 'rgba(255, 110, 196, 0.2)',
        borderRadius: 20,
        padding: 8,
    },
    tinySpinner: {
    },

    // Video error overlay
    videoErrorOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: SIZES.radius,
    },
    videoErrorText: {
        color: '#ff6b6b',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },

    // Unfocused overlay
    unfocusedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: SIZES.radius,
    },
    unfocusedText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        marginTop: 8,
        fontWeight: '500',
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
});

export default ProfileVideoSwiper;
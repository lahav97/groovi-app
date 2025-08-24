import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Modal,
    Alert,
} from 'react-native';
import { Video } from 'expo-av';
import { PanGestureHandler, ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    runOnJS,
    withSpring,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

import {
    fetchInitialMusiciansForMatch,
    loadMoreMusiciansForMatch,
    resetVideoState,
    forceResetHasMoreVideos,
} from '../../services/videoService';

import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { LAYOUT, COLORS } from '../../styles/theme';
import { handleError, ERROR_MESSAGES } from '../../utils/errors';

// ----- Layout constants
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.75;
const VIDEO_HEIGHT = CARD_HEIGHT * 0.55;

// ----- Deck config
const DECK_SIZE = 4;
const CARD_SCALE_OFFSET = 0.007;
const CARD_Y_OFFSET = 6;
const CARD_X_OFFSET = 7;

// ----- Gesture
const SWIPE_THRESHOLD = width * 0.2;
const MIN_SWIPE_DELAY = 300;

// ----- Batch sizes
const INITIAL_BATCH_SIZE = 5;
const LOAD_MORE_BATCH_SIZE = 3;

// Helper functions
const getConversationId = (myEmail = '', otherUserName = '') =>
    `${myEmail || 'unknown'}|${otherUserName || 'unknown'}`;

const formatField = (value, fallback = 'Not specified') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        return keys.length ? keys.join(', ') : fallback;
    }
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    const str = String(value).trim();
    return str || fallback;
};

const formatInstruments = (instruments) => formatField(instruments, 'No instruments listed');

// MAIN COMPONENT
const MatchScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const { user } = useAuth();

    // FIXED: Proper fallback for email
    const currentUserEmail = useMemo(() =>
            user?.email || user?.username || 'guest@groovi.app',
        [user?.email, user?.username]
    );

    // State
    const [musicians, setMusicians] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPreloading, setIsPreloading] = useState(false);
    const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);
    const [videoLoading, setVideoLoading] = useState(true);

    // MATCH MODAL
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [matchedMusician, setMatchedMusician] = useState(null);

    // Refs
    const videoRef = useRef(null);
    const mountedRef = useRef(true);
    const preloadTimeoutRef = useRef(null);
    const panGestureRef = useRef(null);
    const scrollViewRef = useRef(null);

    // Animation values (top card only)
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);

    // Current musician (memoized for performance)
    const currentMusician = useMemo(() =>
            musicians[currentIndex] || null,
        [musicians, currentIndex]
    );

    // Better video count calculation
    const videoCount = useMemo(() => {
        if (!currentMusician?.videos || !Array.isArray(currentMusician.videos)) return 0;
        return currentMusician.videos.length;
    }, [currentMusician?.videos]);

    // Init load
    const loadInitialMusicians = useCallback(async () => {
        if (!mountedRef.current) return;
        setLoading(true);
        setError(null);

        try {
            console.log('Loading initial musicians...');
            const fresh = await fetchInitialMusiciansForMatch(currentUserEmail, INITIAL_BATCH_SIZE);

            if (!mountedRef.current) return;
            if (!fresh || fresh.length === 0) {
                setError(ERROR_MESSAGES.NETWORK.NO_MUSICIANS);
                return;
            }

            const transformed = fresh.map((m, i) => ({
                ...m,
                id: m.id || `mus-${i}-${Date.now()}`,
                username: m.username || `user_${i}`,
                videos: Array.isArray(m.videos) ? m.videos : [],
                bio: m.bio,
                location: m.location,
                age: m.age,
                rating: m.rating,
                instruments: m.instruments,
                genres: m.genres,
                currentVideoIndex: 0,
                cardPosition: i,
                loadedAt: Date.now(),
            }));

            setMusicians(transformed);
            setCurrentIndex(0);
            setCurrentVideoIndex(0);
            console.log(`Loaded ${transformed.length} musicians`);
        } catch (e) {
            console.error('Error loading initial musicians:', e);
            if (mountedRef.current) {
                setError(handleError(e, 'MatchScreen/loadInitial') || ERROR_MESSAGES.NETWORK.LOAD_FAILED);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [currentUserEmail]);

    const loadAdditionalMusicians = useCallback(async () => {
        if (!mountedRef.current || isPreloading) return;
        setIsPreloading(true);
        console.log('Preloading more musicians...');

        try {
            const more = await loadMoreMusiciansForMatch(currentUserEmail, LOAD_MORE_BATCH_SIZE);
            if (more && more.length && mountedRef.current) {
                const append = more.map((m, idx) => ({
                    ...m,
                    id: m.id || `mus-more-${musicians.length + idx}-${Date.now()}`,
                    username: m.username || `user_more_${idx}`,
                    videos: Array.isArray(m.videos) ? m.videos : [],
                    bio: m.bio,
                    location: m.location,
                    age: m.age,
                    rating: m.rating,
                    instruments: m.instruments,
                    genres: m.genres,
                    currentVideoIndex: 0,
                    cardPosition: musicians.length + idx,
                    loadedAt: Date.now(),
                }));
                setMusicians((prev) => [...prev, ...append]);
                console.log(`Added ${append.length} more musicians`);
            } else {
                console.log('No additional musicians received');
            }
        } catch (e) {
            console.error('Error preloading musicians:', e);
        } finally {
            if (mountedRef.current) {
                setIsPreloading(false);
            }
        }
    }, [currentUserEmail, isPreloading, musicians.length]);

    // Navigation helper
    const moveToNextMusician = useCallback(() => {
        if (!mountedRef.current || isSwipeInProgress) return;

        console.log('Moving to next musician...', { currentIndex, total: musicians.length });
        if (currentIndex < musicians.length - 1) {
            const nextIdx = currentIndex + 1;
            setCurrentIndex(nextIdx);
            setCurrentVideoIndex(0);
            setPaused(false);
            setTimeout(() => {
                if (mountedRef.current) {
                    setIsSwipeInProgress(false);
                }
            }, MIN_SWIPE_DELAY);
            return;
        }

        // Need to load more, then try advance
        setIsSwipeInProgress(true);
        console.log('Loading more before next...');
        if (!isPreloading) {
            loadAdditionalMusicians()
                .then(() => {
                    setTimeout(() => {
                        if (!mountedRef.current) return;
                        setMusicians((current) => {
                            if (current.length > currentIndex + 1) {
                                const next = currentIndex + 1;
                                setCurrentIndex(next);
                                setCurrentVideoIndex(0);
                                setPaused(false);
                                console.log(`Advanced after load to index ${next}`);
                            } else {
                                console.log('No more musicians available');
                                setError('No more musicians available. Try adjusting your filters!');
                            }
                            return current;
                        });
                    }, 200);
                })
                .catch((e) => {
                    console.error('Load more failed:', e);
                    if (mountedRef.current) {
                        setError('Failed to load more musicians. Please try again.');
                    }
                })
                .finally(() => {
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setIsSwipeInProgress(false);
                        }
                    }, MIN_SWIPE_DELAY);
                });
        }
    }, [currentIndex, isPreloading, isSwipeInProgress, musicians.length, loadAdditionalMusicians]);

    // Swipe actions
    const handleSwipeLeft = useCallback(() => {
        if (isSwipeInProgress || !mountedRef.current) return;
        console.log(`Swiped LEFT on @${currentMusician?.username} - pass`);
        setIsSwipeInProgress(true);
        moveToNextMusician();
    }, [currentMusician?.username, isSwipeInProgress, moveToNextMusician]);

    const handleSwipeRight = useCallback(() => {
        if (isSwipeInProgress || !mountedRef.current) return;
        console.log(`Swiped RIGHT on @${currentMusician?.username} - opening Jam popup`);
        setIsSwipeInProgress(true);
        setMatchedMusician(currentMusician || null);
        setShowMatchModal(true);

        // FIXED: Reset animations properly
        translateX.value = withTiming(0, { duration: 120 });
        translateY.value = withTiming(0, { duration: 120 });
        rotate.value = withTiming(0, { duration: 120 });

        setPaused(true);
        setTimeout(() => {
            if (mountedRef.current) {
                setIsSwipeInProgress(false);
            }
        }, 150);
    }, [currentMusician, isSwipeInProgress, translateX, translateY, rotate]);

    // Modal handlers
    const handleKeepBrowsing = useCallback(() => {
        console.log('Keep Browsing');
        setShowMatchModal(false);
        setMatchedMusician(null);
        setTimeout(() => moveToNextMusician(), 120);
    }, [moveToNextMusician]);

    const handleStartChatting = useCallback(() => {
        const theirUser = matchedMusician?.username || 'unknown';
        const conversationId = getConversationId(currentUserEmail, theirUser);

        if (!theirUser || theirUser === 'unknown') {
            Alert.alert('Error', 'Unable to start chat. Please try again.');
            return;
        }

        console.log('Start Chatting', { theirUser, conversationId, currentUserEmail });
        setShowMatchModal(false);

        navigation.navigate('ChatScreen', {
            userName: theirUser,
            conversationId,
            isNewConversation: true,
        });
    }, [matchedMusician?.username, currentUserEmail, navigation]);

    // Video controls
    const toggleVideoPlayback = useCallback(() => {
        if (!mountedRef.current) return;
        console.log(paused ? 'PLAY video' : 'PAUSE video');
        setPaused((p) => !p);
    }, [paused]);

    const handleVideoNavigation = useCallback((direction) => {
        const vids = currentMusician?.videos || [];
        if (vids.length <= 1 || !mountedRef.current) return;

        setCurrentVideoIndex((prev) => {
            if (direction === 'left') {
                const next = prev > 0 ? prev - 1 : vids.length - 1;
                console.log(`Video left: ${next + 1}/${vids.length}`);
                return next;
            } else {
                const next = prev < vids.length - 1 ? prev + 1 : 0;
                console.log(`Video right: ${next + 1}/${vids.length}`);
                return next;
            }
        });
    }, [currentMusician?.videos]);

    // Gesture handler (top card) - ENHANCED FOR SCROLL PRIORITY
    const gestureHandler = useAnimatedGestureHandler({
        onStart: (event) => {
            'worklet';
            // If gesture starts in profile area (bottom half), prefer scroll
            const isInProfileArea = event.y > VIDEO_HEIGHT;
            if (isInProfileArea && Math.abs(event.velocityX) < Math.abs(event.velocityY)) {
                // Vertical movement in profile area - let scroll handle it
                return;
            }
        },
        onActive: (event) => {
            'worklet';
            // Only handle horizontal gestures for card swiping
            const isHorizontalGesture = Math.abs(event.translationX) > Math.abs(event.translationY);

            if (isHorizontalGesture) {
                translateX.value = event.translationX;
                translateY.value = event.translationY;
                rotate.value = interpolate(event.translationX, [-width, width], [-20, 20]);
            }
        },
        onEnd: (event) => {
            'worklet';
            const isRight = event.translationX > SWIPE_THRESHOLD;
            const isLeft = event.translationX < -SWIPE_THRESHOLD;

            if (isRight) {
                // RIGHT: snap back to center and open popup (no fling off-screen)
                translateX.value = withTiming(0, { duration: 120 });
                translateY.value = withTiming(0, { duration: 120 });
                rotate.value = withTiming(0, { duration: 120 });
                runOnJS(handleSwipeRight)();
                return;
            }

            if (isLeft) {
                // LEFT: keep original fling-out behavior
                translateX.value = withSpring(-width * 1.8, { damping: 25, stiffness: 300 });
                translateY.value = withSpring(event.translationY + 80, { damping: 25, stiffness: 300 });
                runOnJS(handleSwipeLeft)();
                return;
            }

            // Not enough swipe — snap back
            translateX.value = withSpring(0, { damping: 20, stiffness: 400 });
            translateY.value = withSpring(0, { damping: 20, stiffness: 400 });
            rotate.value = withSpring(0, { damping: 20, stiffness: 400 });
        },
        onCancel: () => {
            'worklet';
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            rotate.value = withSpring(0);
        },
        onFail: () => {
            'worklet';
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            rotate.value = withSpring(0);
        },
    });

    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotate.value}deg` },
        ],
    }));

    // Render helpers
    const renderStarRating = useCallback((rating) => {
        const num = parseFloat(rating || 0);
        if (num <= 0) return null;
        const full = Math.floor(num);
        const half = num % 1 >= 0.5;
        return (
            <View style={styles.starsContainer}>
                {[...Array(5)].map((_, i) => {
                    if (i < full) return <FontAwesome key={i} name="star" size={16} color="#FFD700" />;
                    if (i === full && half) return <FontAwesome key={i} name="star-half-o" size={16} color="#FFD700" />;
                    return <FontAwesome key={i} name="star-o" size={16} color="#DDD" />;
                })}
                <Text style={styles.ratingText}>{num.toFixed(1)}</Text>
            </View>
        );
    }, []);

    const renderProfileSection = useCallback((musician = currentMusician, isActive = true) => {
        if (!musician) {
            return (
                <View style={styles.profileSection}>
                    <View style={styles.errorContent}>
                        <Icon name="musical-notes-outline" size={40} color="#ccc" />
                        <Text style={styles.noDataText}>No musician data</Text>
                    </View>
                </View>
            );
        }

        console.log('Rendering profile:', {
            username: musician.username,
            location: musician.location,
            instruments: musician.instruments,
        });

        return (
            <View style={styles.profileSection} pointerEvents="auto">
                <GestureScrollView
                    ref={isActive ? scrollViewRef : null}
                    style={styles.profileScrollView}
                    contentContainerStyle={styles.profileContent}
                    showsVerticalScrollIndicator={false}
                    bounces
                    scrollEnabled={isActive}
                    nestedScrollEnabled={true}
                    simultaneousHandlers={panGestureRef}
                >
                    <View style={styles.profileHeader}>
                        <View style={styles.usernameRow}>
                            <Icon name="person-circle" size={24} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.username}>@{musician.username}</Text>
                            {!!musician.age && (
                                <View style={styles.ageBadge}>
                                    <Text style={styles.ageText}>{musician.age}</Text>
                                </View>
                            )}
                        </View>
                        {musician.rating && renderStarRating(musician.rating)}
                    </View>

                    {/* Bio */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="information-circle" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Bio</Text>
                        </View>
                        <Text style={styles.bioText}>
                            {musician.bio || musician.description || musician.about || 'I love to play music!'}
                        </Text>
                    </View>

                    {/* Instruments */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="musical-notes" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Instruments</Text>
                        </View>
                        <Text style={styles.infoText}>{formatInstruments(musician.instruments)}</Text>
                    </View>

                    {/* Location */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="location" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Location</Text>
                        </View>
                        <Text style={styles.infoText}>
                            {formatField(musician.location || musician.address || musician.city, 'No location specified')}
                        </Text>
                    </View>

                    <View style={styles.scrollPadding} />
                </GestureScrollView>

                {isActive && (
                    <View style={styles.swipeInstructions}>
                        <Text style={styles.swipeInstructionsText}>
                            ← Swipe left to pass • Swipe right to like →
                        </Text>
                    </View>
                )}
            </View>
        );
    }, [currentMusician, renderStarRating]);

    const renderVideoContainer = useCallback((musician = currentMusician, vIndex = currentVideoIndex, isActive = true) => {
        const videoUrl = musician?.videos?.[vIndex];

        return (
            <View style={styles.videoContainer}>
                {videoUrl ? (
                    <>
                        <Video
                            ref={isActive ? videoRef : null}
                            source={{ uri: videoUrl }}
                            style={styles.video}
                            resizeMode="cover"
                            shouldPlay={isActive && !paused && isFocused}
                            isLooping
                            isMuted={false}
                            onLoadStart={() => setVideoLoading(true)}
                            onReadyForDisplay={() => setVideoLoading(false)}
                            onError={(error) => {
                                console.warn('Video error:', error);
                                setVideoLoading(false);
                            }}
                        />

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.3)']}
                            style={styles.videoOverlay}
                            pointerEvents="none"
                        />

                        {/* Loading indicator */}
                        {isActive && videoLoading && (
                            <View style={styles.videoLoadingContainer}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.noVideoContainer}>
                        <Icon name="musical-notes" size={60} color="#ccc" />
                        <Text style={styles.noVideoText}>No video</Text>
                    </View>
                )}

                {isActive && musician?.videos && musician.videos.length > 1 && (
                    <>
                        <TouchableOpacity style={styles.leftTapZone} onPress={() => handleVideoNavigation('left')}>
                            <View style={styles.tapIndicator}>
                                <Icon name="chevron-back" size={24} color="rgba(255,255,255,0.9)" />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rightTapZone} onPress={() => handleVideoNavigation('right')}>
                            <View style={styles.tapIndicator}>
                                <Icon name="chevron-forward" size={24} color="rgba(255,255,255,0.9)" />
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                {isActive && (
                    <TouchableOpacity style={styles.centerTapZone} onPress={toggleVideoPlayback}>
                        {paused && (
                            <View style={styles.playButton}>
                                <Icon name="play" size={48} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {isActive && musician?.videos && musician.videos.length > 1 && (
                    <View style={styles.videoCounter}>
                        <Text style={styles.videoCounterText}>{vIndex + 1}/{musician.videos.length}</Text>
                    </View>
                )}
            </View>
        );
    }, [currentMusician, currentVideoIndex, paused, isFocused, videoLoading, handleVideoNavigation, toggleVideoPlayback]);

    const renderCard = useCallback((musician, index, isActive = false) => {
        if (!musician) return null;

        const cardIndex = index - currentIndex;
        const scale = 1 - (cardIndex * CARD_SCALE_OFFSET);
        const tY = cardIndex * CARD_Y_OFFSET;
        const tX = cardIndex === 0 ? 0 : cardIndex * CARD_X_OFFSET;
        const opacity = cardIndex === 0 ? 1 : Math.max(0.75, 1 - (cardIndex * 0.1));
        const uniqueKey = `card-${musician.username}-${index}-${cardIndex}`;

        if (isActive) {
            return (
                <PanGestureHandler
                    ref={panGestureRef}
                    enabled={!showMatchModal}
                    key={uniqueKey}
                    onGestureEvent={gestureHandler}
                    minPointers={1}
                    maxPointers={1}
                    simultaneousHandlers={scrollViewRef}
                >
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                marginLeft: -CARD_WIDTH / 2,
                                transform: [{ scale }, { translateY: tY }, { translateX: tX }],
                                opacity,
                                zIndex: DECK_SIZE - cardIndex,
                            },
                            animatedCardStyle,
                        ]}
                    >
                        {renderVideoContainer(musician, currentVideoIndex, true)}
                        {renderProfileSection(musician, true)}
                    </Animated.View>
                </PanGestureHandler>
            );
        }

        return (
            <View
                key={uniqueKey}
                style={[
                    styles.card,
                    {
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        marginLeft: -CARD_WIDTH / 2,
                        transform: [{ scale }, { translateY: tY }, { translateX: tX }],
                        opacity,
                        zIndex: DECK_SIZE - cardIndex,
                    },
                ]}
                pointerEvents="none"
            >
                {renderVideoContainer(musician, 0, false)}
                {renderProfileSection(musician, false)}
            </View>
        );
    }, [currentIndex, showMatchModal, gestureHandler, animatedCardStyle, renderVideoContainer, currentVideoIndex, renderProfileSection]);

    const renderCardDeck = useCallback(() => {
        const visible = [];
        for (let i = 0; i < DECK_SIZE && (currentIndex + i) < musicians.length; i++) {
            const idx = currentIndex + i;
            const m = musicians[idx];
            const active = i === 0;
            if (m) visible.push(renderCard(m, idx, active));
        }
        return visible;
    }, [currentIndex, musicians, renderCard]);

    const handleRetry = useCallback(() => {
        if (!mountedRef.current) return;
        console.log('Retry: resetting services and reloading');
        setError(null);
        setMusicians([]);
        setCurrentIndex(0);
        setCurrentVideoIndex(0);
        setIsPreloading(false);

        try {
            resetVideoState();
            forceResetHasMoreVideos();
            console.log('Video service state reset for retry');
        } catch (e) {
            console.warn('Reset error:', e);
        }

        setTimeout(() => {
            if (mountedRef.current) {
                loadInitialMusicians();
            }
        }, 100);
    }, [loadInitialMusicians]);

    // Effects
    useEffect(() => {
        mountedRef.current = true;
        loadInitialMusicians();

        return () => {
            mountedRef.current = false;

            // cleanup timers
            if (preloadTimeoutRef.current) {
                clearTimeout(preloadTimeoutRef.current);
                preloadTimeoutRef.current = null;
            }

            // reset services
            try {
                resetVideoState();
                forceResetHasMoreVideos();
                console.log('Video service state reset');
            } catch (e) {
                console.warn('Reset error:', e);
            }

            // unload video
            if (videoRef.current) {
                try {
                    videoRef.current.pauseAsync?.();
                    videoRef.current.unloadAsync?.();
                } catch (e) {
                    console.warn('Video cleanup error:', e);
                }
            }
        };
    }, [loadInitialMusicians]);

    // Pause when screen not focused
    useEffect(() => {
        if (!isFocused && videoRef.current) {
            try {
                videoRef.current.pauseAsync?.();
            } catch (e) {
                console.warn('Video pause error:', e);
            }
        }
    }, [isFocused]);

    // Reset animations when top card changes
    useEffect(() => {
        translateX.value = withTiming(0, { duration: 100 });
        translateY.value = withTiming(0, { duration: 100 });
        rotate.value = withTiming(0, { duration: 100 });
    }, [currentIndex, translateX, translateY, rotate]);

    // Auto-preload next chunk when near the end
    useEffect(() => {
        if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            const remaining = musicians.length - currentIndex;
            if (remaining <= 4 && !isPreloading && musicians.length > 0) {
                console.log('Triggering preload (remaining <= 4)');
                loadAdditionalMusicians();
            }
        }, 300);

        return () => {
            if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
        };
    }, [currentIndex, musicians.length, isPreloading, loadAdditionalMusicians]);

    // Render states
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color="#ff6ec4" />
                    <Text style={styles.loadingText}>Loading musicians...</Text>
                    <Text style={styles.loadingSubtext}>Preparing {INITIAL_BATCH_SIZE} profiles for instant browsing</Text>
                </View>
                <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                    <BottomNavigation />
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <View style={styles.errorCard}>
                    <Icon name="musical-notes-outline" size={60} color="#ccc" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <LinearGradient
                            colors={COLORS?.primaryGradient || ['#ff6ec4', '#ffc93c', '#1c92d2']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.retryGradient}
                        >
                            <Text style={styles.retryButtonText}>Try Again</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
                <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                    <BottomNavigation />
                </View>
            </View>
        );
    }

    if (!musicians || musicians.length === 0) {
        return (
            <View style={styles.errorContainer}>
                <View style={styles.errorCard}>
                    <Icon name="search" size={60} color="#ccc" />
                    <Text style={styles.errorText}>{ERROR_MESSAGES.NETWORK.NO_MUSICIANS}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <LinearGradient
                            colors={COLORS?.primaryGradient || ['#ff6ec4', '#ffc93c', '#1c92d2']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.retryGradient}
                        >
                            <Text style={styles.retryButtonText}>Reload</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
                <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                    <BottomNavigation />
                </View>
            </View>
        );
    }

    if (!currentMusician) {
        return (
            <View style={styles.errorContainer}>
                <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color="#ff6ec4" />
                    <Text style={styles.loadingText}>Loading musician data...</Text>
                </View>
                <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                    <BottomNavigation />
                </View>
            </View>
        );
    }

    return (
        <>
            <View style={styles.container}>
                <View
                    style={styles.cardDeckContainer}
                    pointerEvents={showMatchModal ? 'none' : 'auto'}
                >
                    {renderCardDeck()}
                </View>

                <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                    <BottomNavigation />
                </View>
            </View>

            {/* It's a Jam! Modal */}
            {showMatchModal && (
                <View style={styles.matchOverlay}>
                    <View style={styles.matchCard}>
                        <Text style={styles.matchTitle}>It's a Jam!</Text>
                        <Text style={styles.matchSubtitle}>Time to jam together!</Text>
                        {!!matchedMusician?.username && (
                            <Text style={styles.matchUser}>@{matchedMusician.username}</Text>
                        )}

                        <View style={styles.matchButtons}>
                            <TouchableOpacity
                                style={[styles.matchBtn, styles.browseBtn]}
                                onPress={handleKeepBrowsing}
                            >
                                <Text style={styles.browseText}>Keep Browsing</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.matchBtn, styles.chatBtn]}
                                onPress={handleStartChatting}
                            >
                                <Text style={styles.chatText}>Start Chatting</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </>
    );
};

// StyleSheet moved outside component for better performance
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: 60
    },
    cardDeckContainer: {
        width: '100%',
        height: CARD_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        flex: 1,
        marginBottom: 10
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#fff',
        borderRadius: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 25,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },

    // Video container
    videoContainer: {
        height: VIDEO_HEIGHT,
        position: 'relative',
        backgroundColor: '#000',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden'
    },
    video: { width: '100%', height: '100%' },
    videoLoadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60
    },
    noVideoContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
    },
    noVideoText: {
        marginTop: 10,
        fontSize: 16,
        color: '#999',
        fontWeight: '500'
    },

    // Tap zones
    leftTapZone: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '30%',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 20
    },
    rightTapZone: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '30%',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20
    },
    centerTapZone: {
        position: 'absolute',
        left: '30%',
        right: '30%',
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    tapIndicator: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    playButton: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 50,
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    videoCounter: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20
    },
    videoCounterText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600'
    },

    // Profile section
    profileSection: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        minHeight: CARD_HEIGHT - VIDEO_HEIGHT,
    },
    profileScrollView: {
        flex: 1,
        paddingHorizontal: 24,
        maxHeight: CARD_HEIGHT - VIDEO_HEIGHT - 60, // Leave space for swipe instructions
    },
    profileContent: {
        paddingTop: 20,
        paddingBottom: 20
    },
    errorContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    noDataText: {
        marginTop: 12,
        fontSize: 16,
        color: '#999',
        fontWeight: '500'
    },
    scrollPadding: { height: 80 },
    profileHeader: { marginBottom: 20 },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap'
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginLeft: 8,
        flex: 1
    },
    ageBadge: {
        backgroundColor: '#ff6ec4',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 15,
        marginLeft: 8
    },
    ageText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    starsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    ratingText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#333'
    },
    infoCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6ec4'
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 8
    },
    bioText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#555',
        fontStyle: 'italic'
    },
    infoText: {
        fontSize: 15,
        lineHeight: 20,
        color: '#555',
        fontWeight: '500'
    },

    // Swipe instructions
    swipeInstructions: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center'
    },
    swipeInstructionsText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
        textAlign: 'center'
    },

    // Loading states
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    loadingCard: {
        backgroundColor: '#fff',
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        minWidth: 200,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#333'
    },
    loadingSubtext: {
        marginTop: 6,
        fontSize: 14,
        color: '#999',
        textAlign: 'center'
    },

    // Error states
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
    },
    errorCard: {
        backgroundColor: '#fff',
        padding: 40,
        borderRadius: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        minWidth: 250,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8
    },
    retryButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#ff6ec4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8
    },
    retryGradient: {
        paddingHorizontal: 32,
        paddingVertical: 14
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },

    // Bottom navigation
    bottomNavContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 10
    },

    // Match Modal Styles
    matchOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        elevation: 99999,
        width: '100%',
        height: '100%',
    },
    matchCard: {
        width: 300,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
        marginHorizontal: 20,
    },
    closeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    matchTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    matchSubtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 12,
        textAlign: 'center',
    },
    matchUser: {
        fontSize: 18,
        color: '#ff6ec4',
        fontWeight: '600',
        marginBottom: 20,
        textAlign: 'center',
    },
    matchButtons: {
        flexDirection: 'column',
        width: '100%',
        gap: 12,
    },
    matchBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        alignItems: 'center',
        width: '100%',
    },
    browseBtn: {
        borderWidth: 1,
        borderColor: '#ff6ec4',
        backgroundColor: 'transparent',
    },
    chatBtn: {
        backgroundColor: '#ff6ec4',
    },
    chatBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
    },
    browseText: {
        color: '#ff6ec4',
        fontSize: 16,
        fontWeight: '600',
    },
    chatText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MatchScreen;
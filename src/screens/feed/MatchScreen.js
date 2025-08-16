import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Video } from 'expo-av';
import { PanGestureHandler } from 'react-native-gesture-handler';
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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import {
    fetchInitialMusiciansForMatch,
    loadMoreMusiciansForMatch,
    resetVideoState,
    forceResetHasMoreVideos
} from '../../services/videoService';

import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { LAYOUT } from '../../styles/theme';
import { COLORS } from '../../styles/theme';

import {
    handleError,
    createNetworkError,
    ERROR_MESSAGES
} from '../../utils/errors';

const { width, height } = Dimensions.get('window');

const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.75; // Reduced from 0.8 to 0.75 for better screen positioning
const VIDEO_HEIGHT = CARD_HEIGHT * 0.55;

// Card deck configuration
const DECK_SIZE = 4;
const CARD_SCALE_OFFSET = 0.007;
const CARD_Y_OFFSET = 6;
const CARD_X_OFFSET = 7;

const MatchScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();

    // State management
    const [musicians, setMusicians] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [error, setError] = useState(null);
    const [isPreloading, setIsPreloading] = useState(false);
    const [preloadedMusicians, setPreloadedMusicians] = useState([]);
    const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);

    // Refs
    const videoRef = useRef(null);
    const mountedRef = useRef(true);
    const stabilityTimeoutRef = useRef(null);

    // Configuration
    const currentUser = 'lahav97';
    const INITIAL_BATCH_SIZE = 5;
    const LOAD_MORE_BATCH_SIZE = 3;
    const MIN_SWIPE_DELAY = 300;
    const SWIPE_THRESHOLD = width * 0.2;

    // Animation values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(1);

    const currentMusician = musicians[currentIndex];

    // Load initial musicians using working videoService function
    const loadInitialMusicians = async () => {
        if (!mountedRef.current) return;

        try {
            setLoading(true);
            setError(null);
            console.log('Loading initial musicians with complete profiles from MATCH API...');

            const newMusicians = await fetchInitialMusiciansForMatch(currentUser, INITIAL_BATCH_SIZE);

            if (!mountedRef.current) return;

            if (newMusicians.length === 0) {
                setError(ERROR_MESSAGES.NETWORK.NO_MUSICIANS);
                return;
            }

            // Transform musicians for card format - NOW WITH COMPLETE DATA FROM MATCH API
            const transformedMusicians = newMusicians.map((musician, index) => ({
                ...musician,
                id: musician.id || `musician-${index}-${Date.now()}`,
                username: musician.username || `user_${index}`,
                videos: musician.videos || [],
                // ✅ NOW THESE ARE REAL VALUES FROM MATCH API WITH COMPLETE DATABASE DATA!
                bio: musician.bio, // Real bio from complete profile
                location: musician.location, // Real location from complete profile
                age: musician.age,
                rating: musician.rating,
                instruments: musician.instruments || 'Guitar',
                genres: musician.genres || 'Music',
                currentVideoIndex: 0,
                cardPosition: index,
                loadedAt: Date.now(),
            }));

            if (mountedRef.current) {
                setMusicians(transformedMusicians);
                setPreloadedMusicians(transformedMusicians);
                setCurrentIndex(0);
                setCurrentVideoIndex(0);

                console.log(`Successfully loaded ${transformedMusicians.length} musicians`);
            }

        } catch (error) {
            console.error('Error loading musicians:', error);
            if (mountedRef.current) {
                setError(handleError(error, 'MatchScreen/loadInitialMusicians') || ERROR_MESSAGES.NETWORK.LOAD_FAILED);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    };
    // Load additional musicians using working videoService function
    const loadAdditionalMusicians = async () => {
        if (isPreloading || !mountedRef.current) {
            console.log('Preload skipped - already loading or component unmounted');
            return;
        }

        try {
            setIsPreloading(true);
            console.log('Loading additional musicians with complete profiles from MATCH API...');

            const moreMusicians = await loadMoreMusiciansForMatch(currentUser, LOAD_MORE_BATCH_SIZE);

            console.log('Received additional musicians from MATCH API:', {
                count: moreMusicians?.length || 0,
                usernames: moreMusicians?.map(m => m.username) || [],
                hasCompleteData: moreMusicians?.every(m => m.bio && m.location) || false
            });

            if (moreMusicians && moreMusicians.length > 0 && mountedRef.current) {
                // Transform additional musicians - NOW WITH COMPLETE DATA FROM MATCH API
                const transformedMusicians = moreMusicians.map((musician, index) => ({
                    ...musician,
                    id: musician.id || `musician-more-${musicians.length + index}-${Date.now()}`,
                    username: musician.username || `user_more_${index}`,
                    videos: musician.videos || [],
                    // FIXED: Keep actual database values (don't override with defaults)
                    bio: musician.bio,
                    location: musician.location,
                    age: musician.age,
                    rating: musician.rating,
                    instruments: musician.instruments || 'Guitar',
                    genres: musician.genres || 'Music',
                    currentVideoIndex: 0,
                    cardPosition: musicians.length + index,
                    loadedAt: Date.now(),
                }));

                // Update state with new musicians
                setMusicians(prevMusicians => {
                    const newList = [...prevMusicians, ...transformedMusicians];
                    console.log('Updated musicians list:', {
                        previousCount: prevMusicians.length,
                        newCount: newList.length,
                        addedCount: transformedMusicians.length
                    });
                    return newList;
                });

                setPreloadedMusicians(prev => [...prev, ...transformedMusicians]);
                console.log(`Successfully loaded ${transformedMusicians.length} additional musicians`);
            } else {
                console.log('No additional musicians received');
            }
        } catch (error) {
            console.error('Error loading additional musicians:', error);
        } finally {
            if (mountedRef.current) {
                setIsPreloading(false);
            }
        }
    };


    // Component mount and cleanup
    useEffect(() => {
        mountedRef.current = true;
        loadInitialMusicians();

        return () => {
            mountedRef.current = false;

            // Clear stability timeout
            if (stabilityTimeoutRef.current) {
                clearTimeout(stabilityTimeoutRef.current);
                stabilityTimeoutRef.current = null;
            }

            // Reset video service state
            try {
                resetVideoState();
                forceResetHasMoreVideos();
                console.log('Video service state reset');
            } catch (resetError) {
                console.warn('Video service reset error:', resetError);
            }

            // Clean up video
            if (videoRef.current) {
                try {
                    videoRef.current.pauseAsync?.();
                    videoRef.current.unloadAsync?.();
                } catch (cleanupError) {
                    console.warn('Video cleanup error:', cleanupError);
                }
                videoRef.current = null;
            }

            // Clear state
            setMusicians([]);
            setCurrentIndex(0);
            setCurrentVideoIndex(0);

            console.log('MatchScreen cleanup complete');
        };
    }, []);

    // Preload trigger with stability timeout
    useEffect(() => {
        if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
        }

        stabilityTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
                const remainingCards = musicians.length - currentIndex;
                
                if (remainingCards <= 4 && !isPreloading && musicians.length > 0 && currentIndex >= 0) {
                    console.log('Triggering preload for additional musicians');
                    loadAdditionalMusicians();
                }
            }
        }, 300);

        return () => {
            if (stabilityTimeoutRef.current) {
                clearTimeout(stabilityTimeoutRef.current);
            }
        };
    }, [currentIndex, musicians.length, isPreloading]);

    // Focus handling for video playback
    useEffect(() => {
        if (!isFocused && videoRef.current) {
            try {
                videoRef.current.pauseAsync?.();
            } catch (pauseError) {
                console.warn('Video pause error:', pauseError);
            }
        }
    }, [isFocused]);

    // Reset animations when card changes
    useEffect(() => {
        translateX.value = withTiming(0, { duration: 100 });
        translateY.value = withTiming(0, { duration: 100 });
        rotate.value = withTiming(0, { duration: 100 });
        // Removed scale reset since we're not using scale transforms anymore
    }, [currentIndex]);

    // Navigation functions
    const moveToNextMusician = useCallback(() => {
        if (!mountedRef.current || isSwipeInProgress) return;

        console.log('Moving to next musician...', {
            currentIndex,
            musiciansLength: musicians.length,
            hasNext: currentIndex < musicians.length - 1
        });

        if (currentIndex < musicians.length - 1) {
            // Move to next existing musician
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            setCurrentVideoIndex(0);
            setPaused(false);
            
            console.log(`Moved to index ${nextIndex}`);
            
            setTimeout(() => {
                if (mountedRef.current) {
                    setIsSwipeInProgress(false);
                }
            }, MIN_SWIPE_DELAY);
            
        } else {
            // Load more musicians
            console.log('Loading more musicians...');
            setIsSwipeInProgress(true);
            
            if (!isPreloading) {
                loadAdditionalMusicians().then(() => {
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setMusicians(currentMusicians => {
                                if (currentMusicians.length > currentIndex + 1) {
                                    const nextIndex = currentIndex + 1;
                                    setCurrentIndex(nextIndex);
                                    setCurrentVideoIndex(0);
                                    setPaused(false);
                                    console.log(`Moved to index ${nextIndex} after loading`);
                                } else {
                                    console.log('No more musicians available');
                                    setError('No more musicians available. Try adjusting your filters!');
                                }
                                return currentMusicians;
                            });
                        }
                    }, 200);
                }).catch((error) => {
                    console.error('Failed to load more musicians:', error);
                    if (mountedRef.current) {
                        setError('Failed to load more musicians. Please try again.');
                    }
                }).finally(() => {
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setIsSwipeInProgress(false);
                        }
                    }, MIN_SWIPE_DELAY);
                });
            }
        }
    }, [currentIndex, musicians.length, isSwipeInProgress, isPreloading]);

    // Swipe handlers
    const handleSwipeLeft = () => {
        if (isSwipeInProgress || !mountedRef.current) return;
        console.log('Swiped LEFT on:', currentMusician?.username);
        setIsSwipeInProgress(true);
        moveToNextMusician();
    };

    const handleSwipeRight = () => {
        if (isSwipeInProgress || !mountedRef.current) return;
        console.log('Swiped RIGHT on:', currentMusician?.username);
        setIsSwipeInProgress(true);
        moveToNextMusician();
    };

    // Video controls
    const toggleVideoPlayback = () => {
        if (!mountedRef.current) return;
        console.log('Toggle video playback:', !paused ? 'PAUSE' : 'PLAY');
        setPaused(!paused);
    };

    const handleVideoNavigation = (direction) => {
        if (!currentMusician?.videos || currentMusician.videos.length <= 1 || !mountedRef.current) return;

        if (direction === 'left') {
            setCurrentVideoIndex(prev =>
                prev > 0 ? prev - 1 : currentMusician.videos.length - 1
            );
        } else {
            setCurrentVideoIndex(prev =>
                prev < currentMusician.videos.length - 1 ? prev + 1 : 0
            );
        }

        console.log(`Video ${direction} -> ${currentVideoIndex + 1}/${currentMusician.videos.length}`);
    };

    // Gesture handler for swipe animations
    const gestureHandler = useAnimatedGestureHandler({
        onStart: () => {
            // Removed scale animation to prevent card size changes during interactions
        },
        onActive: (event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;
            
            const rotation = interpolate(
                event.translationX,
                [-width, width],
                [-20, 20]
            );
            rotate.value = rotation;
        },
        onEnd: (event) => {
            'worklet';
            const isSwipeRight = event.translationX > SWIPE_THRESHOLD;
            const isSwipeLeft = event.translationX < -SWIPE_THRESHOLD;
            
            if (isSwipeRight || isSwipeLeft) {
                translateX.value = withSpring(
                    isSwipeRight ? width * 1.8 : -width * 1.8,
                    { damping: 25, stiffness: 300 }
                );
                translateY.value = withSpring(
                    event.translationY + (isSwipeRight ? -80 : 80),
                    { damping: 25, stiffness: 300 }
                );
                
                if (isSwipeRight) {
                    runOnJS(handleSwipeRight)();
                } else {
                    runOnJS(handleSwipeLeft)();
                }
                
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 400 });
                translateY.value = withSpring(0, { damping: 20, stiffness: 400 });
                rotate.value = withSpring(0, { damping: 20, stiffness: 400 });
                // Removed scale reset to prevent card size changes
            }
        },
    });

    const animatedCardStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: `${rotate.value}deg` },
                // Removed scale transform to prevent any card size changes
            ],
        };
    });

    // Utility functions
    const getTotalVideoCount = () => {
        if (!currentMusician?.videos || !Array.isArray(currentMusician.videos)) {
            return 0;
        }
        return currentMusician.videos.length;
    };

    const formatInstruments = (musician) => {
        if (!musician?.instruments) return 'Guitar, Acoustic Guitar';

        const instruments = musician.instruments;

        if (typeof instruments === 'object' && !Array.isArray(instruments) && instruments !== null) {
            const keys = Object.keys(instruments);
            if (keys.length === 0) return 'No instruments listed';
            return keys.join(', ');
        }

        if (Array.isArray(instruments)) {
            if (instruments.length === 0) return 'No instruments listed';
            return instruments.join(', ');
        }

        const stringValue = String(instruments).trim();
        return stringValue || 'No instruments listed';
    };

    const formatField = (value, defaultValue = 'Not specified') => {
        if (!value) return defaultValue;

        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
            const keys = Object.keys(value);
            return keys.length > 0 ? keys.join(', ') : defaultValue;
        }

        if (Array.isArray(value)) {
            return value.length > 0 ? value.join(', ') : defaultValue;
        }

        const stringValue = String(value).trim();
        return stringValue || defaultValue;
    };

    const renderStarRating = (rating) => {
        if (!rating) return null;

        const numRating = parseFloat(rating) || 0;
        if (numRating <= 0) return null;

        const fullStars = Math.floor(numRating);
        const hasHalfStar = numRating % 1 >= 0.5;

        return (
            <View style={styles.starsContainer}>
                {[...Array(5)].map((_, i) => {
                    if (i < fullStars) {
                        return <FontAwesome key={`star-${i}`} name="star" size={16} color="#FFD700" />;
                    } else if (i === fullStars && hasHalfStar) {
                        return <FontAwesome key={`star-${i}`} name="star-half-o" size={16} color="#FFD700" />;
                    } else {
                        return <FontAwesome key={`star-${i}`} name="star-o" size={16} color="#DDD" />;
                    }
                })}
                <Text style={styles.ratingText}>{numRating.toFixed(1)}</Text>
            </View>
        );
    };

    // Render functions
    const renderProfileSection = (musician = currentMusician, isActive = true) => {
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

        // DEBUG: Log what data we have for this musician
        console.log('🔍 Rendering musician:', {
            username: musician.username,
            bio: musician.bio,
            address: musician.address,
            location: musician.location,
            instruments: musician.instruments
        });

        return (
            <View style={styles.profileSection}>
                <ScrollView
                    style={styles.profileScrollView}
                    contentContainerStyle={styles.profileContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    scrollEnabled={isActive}
                >
                    <View style={styles.profileHeader}>
                        <View style={styles.usernameRow}>
                            <Icon name="person-circle" size={24} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.username}>@{musician.username}</Text>
                            {musician.age && (
                                <View style={styles.ageBadge}>
                                    <Text style={styles.ageText}>{musician.age}</Text>
                                </View>
                            )}
                        </View>

                        {musician.rating && renderStarRating(musician.rating)}
                    </View>

                    {/* 1. BIO SECTION */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="information-circle" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Bio</Text>
                        </View>
                        <Text style={styles.bioText}>
                            {/* Check multiple possible bio fields */}
                            {musician.bio || musician.description || musician.about || 'I love to play music!'}
                        </Text>
                    </View>

                    {/* 2. INSTRUMENTS SECTION */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="musical-notes" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Instruments</Text>
                        </View>
                        <Text style={styles.infoText}>{formatInstruments(musician)}</Text>
                    </View>

                    {/* 3. LOCATION SECTION */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Icon name="location" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                            <Text style={styles.infoLabel}>Location</Text>
                        </View>
                        <Text style={styles.infoText}>
                            {/* Prioritize location field over address for consistency with ProfileScreen */}
                            {musician.location || musician.address || musician.city || 'No location specified'}
                        </Text>
                    </View>

                    <View style={styles.scrollPadding} />
                </ScrollView>

                {isActive && (
                    <View style={styles.swipeInstructions}>
                        <Text style={styles.swipeInstructionsText}>
                            ← Swipe left to pass • Swipe right to like →
                        </Text>
                    </View>
                )}
            </View>
        );
    };


    const renderVideoContainer = (musician = currentMusician, videoIndex = currentVideoIndex, isActive = true) => {
        const videoUrl = musician?.videos?.[videoIndex];

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
                        />

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.3)']}
                            style={styles.videoOverlay}
                            pointerEvents="none"
                        />
                    </>
                ) : (
                    <View style={styles.noVideoContainer}>
                        <Icon name="musical-notes" size={60} color="#ccc" />
                        <Text style={styles.noVideoText}>No video</Text>
                    </View>
                )}

                {isActive && musician?.videos && musician.videos.length > 1 && (
                    <>
                        <TouchableOpacity
                            style={styles.leftTapZone}
                            onPress={() => handleVideoNavigation('left')}
                        >
                            <View style={styles.tapIndicator}>
                                <Icon name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.rightTapZone}
                            onPress={() => handleVideoNavigation('right')}
                        >
                            <View style={styles.tapIndicator}>
                                <Icon name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                {isActive && (
                    <TouchableOpacity
                        style={styles.centerTapZone}
                        onPress={toggleVideoPlayback}
                    >
                        {paused && (
                            <View style={styles.playButton}>
                                <Icon name="play" size={40} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {isActive && musician?.videos && musician.videos.length > 1 && (
                    <View style={styles.videoCounter}>
                        <Text style={styles.videoCounterText}>
                            {videoIndex + 1}/{musician.videos.length}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const renderCard = (musician, index, isActive = false) => {
        if (!musician) return null;

        const cardIndex = index - currentIndex;
        const scale = 1 - (cardIndex * CARD_SCALE_OFFSET);
        const translateY = cardIndex * CARD_Y_OFFSET;
        const translateX = cardIndex === 0 ? 0 : cardIndex * CARD_X_OFFSET;
        const opacity = cardIndex === 0 ? 1 : Math.max(0.75, 1 - (cardIndex * 0.1));

        const uniqueKey = `card-${musician.username}-${index}-${cardIndex}`;

        if (isActive) {
            return (
                <PanGestureHandler 
                    key={uniqueKey}
                    onGestureEvent={gestureHandler}
                    minPointers={1}
                    maxPointers={1}
                >
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                position: 'absolute',
                                top: 0,
                                left: '50%',
                                marginLeft: -CARD_WIDTH / 2,
                                transform: [
                                    { scale },
                                    { translateY },
                                    { translateX },
                                ],
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
                        transform: [
                            { scale },
                            { translateY },
                            { translateX },
                        ],
                        opacity,
                        zIndex: DECK_SIZE - cardIndex,
                    }
                ]}
                pointerEvents="none"
            >
                {renderVideoContainer(musician, 0, false)}
                {renderProfileSection(musician, false)}
            </View>
        );
    };

    const renderCardDeck = () => {
        const visibleCards = [];
        for (let i = 0; i < DECK_SIZE && (currentIndex + i) < musicians.length; i++) {
            const musicianIndex = currentIndex + i;
            const musician = musicians[musicianIndex];
            const isActive = i === 0;

            if (musician) {
                visibleCards.push(renderCard(musician, musicianIndex, isActive));
            }
        }

        return visibleCards;
    };

    const handleRetry = () => {
        if (!mountedRef.current) return;

        console.log('Retrying with service reset...');
        
        setError(null);
        setMusicians([]);
        setCurrentIndex(0);
        setCurrentVideoIndex(0);
        setIsPreloading(false);
        
        try {
            resetVideoState();
            forceResetHasMoreVideos();
            console.log('Video service state reset for retry');
        } catch (resetError) {
            console.warn('Reset error:', resetError);
        }
        
        setTimeout(() => {
            if (mountedRef.current) {
                loadInitialMusicians();
            }
        }, 100);
    };

    // Render states
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color="#ff6ec4" />
                    <Text style={styles.loadingText}>Loading musicians...</Text>
                    <Text style={styles.loadingSubtext}>
                        Preparing {INITIAL_BATCH_SIZE} profiles for instant browsing
                    </Text>
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
        <View style={styles.container}>
            <View style={styles.cardDeckContainer}>
                {renderCardDeck()}
            </View>

            <View style={styles.floatingCounter}>
                <Text style={styles.floatingCounterText}>
                    {getTotalVideoCount() > 0 ? `${currentVideoIndex + 1} of ${getTotalVideoCount()}` : 'No videos'}
                </Text>
            </View>

            <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
                <BottomNavigation />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    cardDeckContainer: {
        width: '100%',
        height: CARD_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        flex: 1, // Make it flexible to take available space
        marginBottom: 10, // Minimal margin for spacing from bottom nav
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
    videoContainer: {
        height: VIDEO_HEIGHT,
        position: 'relative',
        backgroundColor: '#000',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    videoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
    },
    noVideoContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    noVideoText: {
        marginTop: 10,
        fontSize: 16,
        color: '#999',
        fontWeight: '500',
    },
    leftTapZone: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '30%',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 20,
    },
    rightTapZone: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '30%',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20,
    },
    centerTapZone: {
        position: 'absolute',
        left: '30%',
        right: '30%',
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tapIndicator: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 40,
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    videoCounter: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    videoCounterText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    profileSection: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        position: 'relative',
    },
    profileScrollView: {
        flex: 1,
        paddingHorizontal: 24,
    },
    profileContent: {
        paddingTop: 20,
        paddingBottom: 20,
    },
    errorContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    noDataText: {
        marginTop: 12,
        fontSize: 16,
        color: '#999',
        fontWeight: '500',
    },
    scrollPadding: {
        height: 80,
    },
    profileHeader: {
        marginBottom: 20,
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginLeft: 8,
        flex: 1,
    },
    ageBadge: {
        backgroundColor: '#ff6ec4',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 15,
        marginLeft: 8,
    },
    ageText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    starsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    ratingText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    infoCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ff6ec4',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 8,
    },
    bioText: {
    fontSize: 15,
        lineHeight: 22,
        color: '#555',
        fontStyle: 'italic',
    },
    infoText: {
        fontSize: 15,
        lineHeight: 20,
        color: '#555',
        fontWeight: '500',
    },
    swipeInstructions: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
    },
    swipeInstructionsText: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
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
        color: '#333',
    },
    loadingSubtext: {
        marginTop: 6,
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
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
        marginBottom: 8,
    },
    retryButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#ff6ec4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    retryGradient: {
        paddingHorizontal: 32,
        paddingVertical: 14,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    bottomNavContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 10,
    },
});

export default MatchScreen;
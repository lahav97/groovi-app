// DiscoverScreen.js - OPTIMIZED VERSION with Filter Integration
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    FlatList,
    Dimensions,
    StyleSheet,
    ActivityIndicator,
    Text,
    TouchableOpacity,
    InteractionManager
} from 'react-native';
import VideoItem from '../../components/video/VideoItem';
import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import TopBar from '../../components/navigationBar/TopNavigation';
import { LAYOUT } from '../../styles/theme';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFilters } from '../../context/FiltersContext';
import {
    fetchInitialMusicians,
    loadMusicianWithoutFilters,
    fetchFilteredMusicians,
    loadMoreFilteredMusicians,
    resetVideoState,
    forceResetHasMoreVideos
} from '../../services/videoService';
import { getDiscoverCache, cacheFeedVideos } from '../../utils/cacheManager';
import BackgroundDataService from '../../services/BackgroundDataService';
import {
    AppError,
    ValidationError,
    NetworkError,
    PermissionError,
    AuthError,
    ERROR_MESSAGES,
    createValidationError,
    createNetworkError,
    createPermissionError,
    createAuthError,
    handleError
} from '../../utils/errors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DISCOVER_CONFIG = {
    INITIAL_BATCH: 5,
    LOAD_MORE_BATCH: 3,
    LOAD_TRIGGER_DISTANCE: 2,
    MAX_VIDEOS_IN_MEMORY: 10,
    PRELOAD_DISTANCE: 3,
    THROTTLE_MS: 500,
    ENABLE_CACHE_CLEANUP: false,
    STABILITY_DELAY: 300,
};

const DiscoverScreen = () => {
    // STATE
    const [musicianVideos, setMusicianVideos] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreVideos, setHasMoreVideos] = useState(true);
    const [error, setError] = useState(null);
    const [currentUser] = useState('lahav97');

    // NAVIGATION AND FILTERS
    const navigation = useNavigation();
    const route = useRoute();
    const { filters } = useFilters();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();

    // REFS for stability
    const flatListRef = useRef(null);
    const isLoadingRef = useRef(false);
    const mountedRef = useRef(true);
    const loadAttempts = useRef(0);
    const lastLoadTime = useRef(0);
    const stabilityTimeoutRef = useRef(null);
    const loadMoreTimeoutRef = useRef(null);
    const currentIndexRef = useRef(0);

    // MEMOIZED VALUES
    const videoHeight = useMemo(() => SCREEN_HEIGHT - insets.bottom, [insets.bottom]);

    // ULTRA-STABLE KEY EXTRACTOR
    const keyExtractor = useCallback((item, index) => {
        const stableId = item.id || item.user_id || `musician-${index}`;
        return `discover-${stableId}-${index}`;
    }, []);

    // STABLE ITEM LAYOUT for smooth scrolling
    const getItemLayout = useCallback((data, index) => ({
        length: videoHeight,
        offset: videoHeight * index,
        index,
    }), [videoHeight]);

    // ENHANCED LOAD INITIAL with Filter Support
    const loadInitialVideos = useCallback(async () => {
        if (isLoadingRef.current) return;

        console.log('🚀 DiscoverScreen: Loading initial musician videos...');
        console.log('🎯 Current filters:', filters);

        setIsInitialLoading(true);
        setError(null);
        isLoadingRef.current = true;

        try {
            // Quick cache check only for non-filtered results
            if (!filters.isActive) {
                const backgroundStatus = BackgroundDataService.getSeparatedSystemStatus();
                if (backgroundStatus.feed.loaded) {
                    const cachedVideos = await getDiscoverCache();
                    if (cachedVideos && cachedVideos.length > 0) {
                        console.log(`⚡ Using ${cachedVideos.length} cached musician videos`);

                        InteractionManager.runAfterInteractions(() => {
                            if (mountedRef.current) {
                                setMusicianVideos(cachedVideos);
                                setCurrentIndex(0);
                                currentIndexRef.current = 0;
                                setIsInitialLoading(false);
                                isLoadingRef.current = false;
                            }
                        });
                        return;
                    }
                }
            }

            // Load fresh musician data with filter support
            resetVideoState();

            let musicians;
            if (filters.isActive) {
                console.log('🎯 Using filtered search with filters:', filters);
                const transformedFilters = {
                    anywhere: filters.anywhere,
                    distance: filters.distance,
                    gender: filters.selectedGender ? [filters.selectedGender.toLowerCase()] : [],
                    instruments: filters.selectedInstruments,
                    genres: filters.selectedGenres,
                    skill: filters.selectedSkill,
                };

                musicians = await fetchFilteredMusicians(currentUser, transformedFilters, DISCOVER_CONFIG.INITIAL_BATCH);
            } else {
                console.log('🎵 Using standard search (no filters)');
                musicians = await fetchInitialMusicians(currentUser, DISCOVER_CONFIG.INITIAL_BATCH);
            }

            if (!mountedRef.current) return;

            if (musicians && musicians.length > 0) {
                const transformedVideos = musicians.map((musician, index) => ({
                    id: `${musician.id || 'unknown'}-${Date.now()}-${index}`,
                    user_id: musician.id,
                    username: musician.username,
                    user: musician.username,
                    video_url: musician.videos[0],
                    videoUrl: musician.videos[0],
                    instruments: musician.instruments,
                    likes: Math.floor(Math.random() * 1000) + 100,
                    comments: Math.floor(Math.random() * 100) + 10,
                }));

                InteractionManager.runAfterInteractions(() => {
                    if (mountedRef.current) {
                        setMusicianVideos(transformedVideos);
                        setCurrentIndex(0);
                        currentIndexRef.current = 0;
                        setHasMoreVideos(true);
                        setIsInitialLoading(false);
                        isLoadingRef.current = false;

                        // Only cache non-filtered results
                        if (!filters.isActive) {
                            setTimeout(() => cacheFeedVideos(transformedVideos), 100);
                        }
                    }
                });

                console.log(`✅ Loaded ${transformedVideos.length} initial musician videos`);
            } else {
                console.log('❌ No musicians received');
                if (mountedRef.current) {
                    const errorMessage = filters.isActive
                        ? 'No musicians found matching your filters. Try adjusting your search criteria.'
                        : ERROR_MESSAGES.NETWORK.NO_MUSICIANS;
                    setError(errorMessage);
                    setHasMoreVideos(false);
                    setIsInitialLoading(false);
                    isLoadingRef.current = false;
                }
            }
        } catch (err) {
            console.error('❌ Failed to load musicians:', handleError(err, 'DiscoverScreen/loadInitial'));
            if (mountedRef.current) {
                setError(handleError(err, 'DiscoverScreen/loadInitial'));
                setIsInitialLoading(false);
                isLoadingRef.current = false;
            }
        }
    }, [currentUser, filters]);

    // ENHANCED LOAD MORE with Filter Support
    const loadMoreVideos = useCallback(async () => {
        if (isLoadingRef.current || !mountedRef.current || isLoadingMore || !hasMoreVideos) {
            return;
        }

        const now = Date.now();
        if (now - lastLoadTime.current < DISCOVER_CONFIG.THROTTLE_MS) {
            return;
        }

        console.log(`📊 Loading more musicians. Current: ${musicianVideos.length}`);
        console.log('🎯 Using filters:', filters.isActive ? filters : 'none');

        if (loadMoreTimeoutRef.current) {
            clearTimeout(loadMoreTimeoutRef.current);
        }

        setIsLoadingMore(true);
        isLoadingRef.current = true;
        lastLoadTime.current = now;

        try {
            let moreMusicians;

            if (filters.isActive) {
                console.log('🎯 Loading more with filters');
                const transformedFilters = {
                    anywhere: filters.anywhere,
                    distance: filters.distance,
                    gender: filters.selectedGender ? [filters.selectedGender.toLowerCase()] : [],
                    instruments: filters.selectedInstruments,
                    genres: filters.selectedGenres,
                    skill: filters.selectedSkill,
                };

                moreMusicians = await loadMoreFilteredMusicians(currentUser, transformedFilters, DISCOVER_CONFIG.LOAD_MORE_BATCH);
            } else {
                console.log('🎵 Loading more without filters');
                moreMusicians = await loadMusicianWithoutFilters(currentUser, DISCOVER_CONFIG.LOAD_MORE_BATCH);
            }

            if (!mountedRef.current) return;

            if (moreMusicians && moreMusicians.length > 0) {
                loadAttempts.current = 0;

                const transformedVideos = moreMusicians.map((musician, index) => ({
                    id: `${musician.id || 'unknown'}-${Date.now()}-${index}`,
                    user_id: musician.id,
                    username: musician.username,
                    user: musician.username,
                    video_url: musician.videos[0],
                    videoUrl: musician.videos[0],
                    instruments: musician.instruments,
                    likes: Math.floor(Math.random() * 1000) + 100,
                    comments: Math.floor(Math.random() * 100) + 10,
                }));

                setMusicianVideos(prevVideos => {
                    const updatedVideos = [...prevVideos, ...transformedVideos];

                    if (DISCOVER_CONFIG.ENABLE_CACHE_CLEANUP &&
                        updatedVideos.length > DISCOVER_CONFIG.MAX_VIDEOS_IN_MEMORY) {

                        const currentIdx = currentIndexRef.current;
                        const safeRemoveCount = Math.max(0, currentIdx - 5);

                        if (safeRemoveCount > 5) {
                            console.log('🧹 Safe background cleanup (non-disruptive)');
                            const cleanedVideos = updatedVideos.slice(safeRemoveCount);

                            InteractionManager.runAfterInteractions(() => {
                                if (mountedRef.current) {
                                    setCurrentIndex(prev => Math.max(0, prev - safeRemoveCount));
                                    currentIndexRef.current = Math.max(0, currentIndexRef.current - safeRemoveCount);
                                }
                            });

                            if (!filters.isActive) {
                                setTimeout(() => cacheFeedVideos(cleanedVideos), 100);
                            }
                            return cleanedVideos;
                        }
                    }

                    if (!filters.isActive) {
                        setTimeout(() => cacheFeedVideos(updatedVideos), 100);
                    }
                    return updatedVideos;
                });

                console.log(`✅ Added ${transformedVideos.length} more musician videos`);
            } else {
                if (loadAttempts.current < 3) {
                    loadMoreTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current) {
                            loadMoreVideos();
                        }
                    }, 2000);
                } else {
                    console.log('🏁 No more musicians available');
                    setHasMoreVideos(false);
                }
            }
        } catch (err) {
            console.error('❌ Failed to load more musicians:', handleError(err, 'DiscoverScreen/loadMore'));

            if (loadAttempts.current < 3) {
                loadMoreTimeoutRef.current = setTimeout(() => {
                    if (mountedRef.current) {
                        loadMoreVideos();
                    }
                }, 2000);
            } else {
                setHasMoreVideos(false);
            }
        } finally {
            if (mountedRef.current) {
                setIsLoadingMore(false);
                isLoadingRef.current = false;
            }
        }
    }, [hasMoreVideos, musicianVideos.length, currentUser, filters]);

    // OPTIMIZED SCROLL HANDLING
    const onScroll = useCallback((event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const newIndex = Math.round(offsetY / videoHeight);

        if (newIndex !== currentIndexRef.current && newIndex >= 0 && newIndex < musicianVideos.length) {
            currentIndexRef.current = newIndex;

            if (stabilityTimeoutRef.current) {
                clearTimeout(stabilityTimeoutRef.current);
            }

            stabilityTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current) {
                    setCurrentIndex(newIndex);

                    const remainingVideos = musicianVideos.length - newIndex - 1;
                    if (remainingVideos <= DISCOVER_CONFIG.LOAD_TRIGGER_DISTANCE &&
                        hasMoreVideos &&
                        !isLoadingMore &&
                        !isLoadingRef.current) {
                        console.log(`🔄 Load trigger: ${remainingVideos} videos remaining`);
                        loadMoreVideos();
                    }
                }
            }, DISCOVER_CONFIG.STABILITY_DELAY);
        }
    }, [musicianVideos.length, hasMoreVideos, isLoadingMore, videoHeight, loadMoreVideos]);

    // STABLE VIEWABILITY CONFIG
    const viewabilityConfig = useMemo(() => ({
        viewAreaCoveragePercentThreshold: 70,
        minimumViewTime: 250,
        waitForInteraction: false,
    }), []);

    // DEBOUNCED VIEWABILITY HANDLER
    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0 && viewableItems[0].index !== null) {
            const newIndex = viewableItems[0].index;

            if (newIndex !== currentIndexRef.current && newIndex >= 0 && newIndex < musicianVideos.length) {
                currentIndexRef.current = newIndex;

                InteractionManager.runAfterInteractions(() => {
                    if (mountedRef.current) {
                        setCurrentIndex(newIndex);

                        const remainingVideos = musicianVideos.length - newIndex - 1;
                        if (remainingVideos <= DISCOVER_CONFIG.LOAD_TRIGGER_DISTANCE &&
                            hasMoreVideos &&
                            !isLoadingMore) {
                            loadMoreVideos();
                        }
                    }
                });
            }
        }
    }, [musicianVideos.length, hasMoreVideos, isLoadingMore, loadMoreVideos]);

    // MEMOIZED RENDER ITEM for performance
    const renderVideoItem = useCallback(({ item, index }) => (
        <VideoItem
            item={{
                id: item.id,
                user: item.username || item.user || 'Unknown',
                description: Array.isArray(item.instruments) ?
                    item.instruments.join(', ') :
                    (item.instruments || 'Music Video'),
                videoUrl: item.video_url || item.videoUrl,
                likes: item.likes,
                comments: item.comments,
            }}
            isVisible={index === currentIndex && isFocused}
            height={videoHeight}
            shouldCache={
                index >= currentIndex - 1 &&
                index <= currentIndex + DISCOVER_CONFIG.PRELOAD_DISTANCE
            }
        />
    ), [currentIndex, isFocused, videoHeight]);

    // OPTIMIZED RETRY HANDLER
    const handleRetry = useCallback(() => {
        console.log('🔄 Retrying musicians load...');
        setError(null);
        setHasMoreVideos(true);
        setMusicianVideos([]);
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        loadAttempts.current = 0;

        if (stabilityTimeoutRef.current) {
            clearTimeout(stabilityTimeoutRef.current);
        }
        if (loadMoreTimeoutRef.current) {
            clearTimeout(loadMoreTimeoutRef.current);
        }

        InteractionManager.runAfterInteractions(() => {
            if (!filters.isActive) {
                BackgroundDataService.forceRefreshAll();
            }
            loadInitialVideos();
        });
    }, [loadInitialVideos, filters.isActive]);

    // Handle filter refresh from navigation
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (route.params?.refreshWithFilters) {
                console.log('🔄 Refreshing with new filters');

                // Clear the param to prevent repeated refreshes
                navigation.setParams({ refreshWithFilters: undefined });

                // Reset and refresh the feed with new filters
                setMusicianVideos([]);
                setCurrentIndex(0);
                currentIndexRef.current = 0;
                setHasMoreVideos(true);
                setError(null);

                // Slight delay for smooth transition
                setTimeout(() => {
                    if (mountedRef.current) {
                        loadInitialVideos();
                    }
                }, 100);
            }
        });

        return unsubscribe;
    }, [navigation, route.params, loadInitialVideos]);

    // EFFECTS
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;

            if (stabilityTimeoutRef.current) {
                clearTimeout(stabilityTimeoutRef.current);
            }
            if (loadMoreTimeoutRef.current) {
                clearTimeout(loadMoreTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const initTimeout = setTimeout(() => {
            if (mountedRef.current) {
                loadInitialVideos();
            }
        }, 100);

        return () => clearTimeout(initTimeout);
    }, [loadInitialVideos]);

    // RENDER STATES
    if (isInitialLoading && musicianVideos.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#ff6ec4" />
                <Text style={styles.loadingText}>
                    {filters.isActive ? 'Finding filtered musicians...' : 'Loading amazing musicians...'}
                </Text>
                <Text style={styles.loadingSubText}>
                    {filters.isActive ? 'Searching with your preferences' : 'Finding great music videos'}
                </Text>
            </View>
        );
    }

    if (error && musicianVideos.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!isInitialLoading && musicianVideos.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>
                    {filters.isActive ? 'No musicians found with these filters' : 'No musicians found'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryText}>Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.feedContainer}>
                <FlatList
                    ref={flatListRef}
                    data={musicianVideos}
                    renderItem={renderVideoItem}
                    keyExtractor={keyExtractor}
                    getItemLayout={getItemLayout}

                    scrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    bounces={false}

                    onScroll={onScroll}
                    scrollEventThrottle={16}

                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}

                    removeClippedSubviews={false}
                    maxToRenderPerBatch={3}
                    windowSize={10}
                    initialNumToRender={3}
                    updateCellsBatchingPeriod={100}

                    decelerationRate="fast"
                    snapToAlignment="start"
                    snapToInterval={videoHeight}
                    disableIntervalMomentum={true}
                    pagingEnabled={false}

                    ListFooterComponent={
                        isLoadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color="#ff6ec4" />
                                <Text style={styles.loadingMoreText}>
                                    {filters.isActive ? 'Finding more filtered musicians...' : 'Finding more musicians...'}
                                </Text>
                            </View>
                        ) : !hasMoreVideos && musicianVideos.length > 0 ? (
                            <View style={styles.endContainer}>
                                <Text style={styles.endText}>
                                    {filters.isActive ? "You've seen all filtered videos! 🎯" : "You've seen all videos! 🌍"}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            </View>

            {/* NAVIGATION OVERLAYS */}
            <View style={[styles.topNavContainer, { top: insets.top }]}>
                <TopBar />
            </View>

            <View style={[styles.bottomNavContainer, {
                height: LAYOUT.navHeight,
                bottom: insets.bottom
            }]}>
                <BottomNavigation />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    feedContainer: {
        flex: 1,
        position: 'relative',
    },
    topNavContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
    },
    bottomNavContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#333',
        zIndex: 10,
    },
    loadingText: {
        color: 'white',
        marginTop: 15,
        fontSize: 16,
        fontWeight: '500',
    },
    loadingSubText: {
        color: '#ff6ec4',
        marginTop: 5,
        fontSize: 14,
        fontStyle: 'italic',
    },
    errorText: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
    },
    retryButton: {
        backgroundColor: '#ff6ec4',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 25,
    },
    retryText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingMoreContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        height: 60,
    },
    loadingMoreText: {
        color: '#ff6ec4',
        fontSize: 12,
        marginLeft: 8,
    },
    endContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        height: 60,
    },
    endText: {
        color: '#666',
        fontSize: 14,
    },
});

export default DiscoverScreen;
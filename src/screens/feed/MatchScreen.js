/**
 * @module MatchScreen
 * PROFESSIONALLY FIXED WITH loadMusicianService
 * 
 * ✅ Uses professional loadMusicianService
 * ✅ Fixed card deck stacking (4 cards visible)
 * ✅ Fixed video side tap navigation
 * ✅ Auto-stop videos when swiping
 * ✅ Clean video counter (no duplicates)
 * ✅ Integrated filters
 * ✅ Tinder-style behavior (no user memory)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  PanResponder,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

// ✅ IMPORT THE NEW SERVICE - Clean and professional
import { 
  loadMusiciansForCards, 
  loadMoreMusicians,
  loadMusiciansWithFilters,
  resetMusicianService 
} from '../../services/loadMusicianService';

import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { LAYOUT } from '../../styles/theme';
import { ERROR_MESSAGES, handleError } from '../../utils/errors';
import { COLORS } from '../../styles/theme';

const { width, height } = Dimensions.get('window');

// ✅ IMPROVED CARD SIZING - Better proportions
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.75;
const VIDEO_HEIGHT = CARD_HEIGHT * 0.68;

// ✅ CARD DECK CONFIGURATION - More visible separation
const DECK_CONFIG = {
  VISIBLE_CARDS: 4,
  CARD_SCALE_FACTOR: 0.08,    // Increased from 0.05 - more visible difference
  CARD_OFFSET_Y: 12,          // Increased from 8 - more visible stacking
  CARD_OFFSET_X: 6,           // Increased from 4 - more depth
};

// ✅ SWIPE ZONES
const SWIPE_ZONES = {
  LEFT_ZONE: width * 0.3,
  RIGHT_ZONE: width * 0.7,
  MIN_DISTANCE: 80,
  VELOCITY_THRESHOLD: 300,
};

/**
 * @function MatchScreen - Professional version with service integration
 */
const MatchScreen = ({ 
  onSwipeRight, 
  onSwipeLeft, 
  onViewFullProfile 
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  
  // ✅ CLEAN STATE MANAGEMENT
  const [musicians, setMusicians] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ FILTER STATE
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [showFilterButton, setShowFilterButton] = useState(true);
  
  // ✅ ANIMATION REFS
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  
  // ✅ CARD DECK ANIMATION REFS - Fixed values for better visibility
  const deckAnimations = useRef(
    Array.from({ length: DECK_CONFIG.VISIBLE_CARDS }, (_, index) => ({
      scale: new Animated.Value(1 - (index * DECK_CONFIG.CARD_SCALE_FACTOR)),
      translateY: new Animated.Value(index * DECK_CONFIG.CARD_OFFSET_Y),
      opacity: new Animated.Value(1),
    }))
  ).current;

  const videoRef = useRef(null);
  const mountedRef = useRef(true);
  const currentUser = 'lahav97'; // Your username

  // ✅ AUTO-STOP VIDEO WHEN SCREEN LOSES FOCUS
  useEffect(() => {
    if (!isFocused && videoRef.current) {
      setPaused(true);
      console.log('🎥 Auto-paused video - screen not focused');
    }
  }, [isFocused]);

  // ✅ FILTER INTEGRATION - Listen for applied filters
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const filters = navigation.getState()?.routes?.find(r => r.name === 'Match')?.params?.filters;
      if (filters && JSON.stringify(filters) !== JSON.stringify(appliedFilters)) {
        setAppliedFilters(filters);
        console.log('🔍 New filters applied:', filters);
        loadMusiciansWithFilters(filters);
      }
    });
    return unsubscribe;
  }, [navigation, appliedFilters]);

  /**
   * ✅ PROFESSIONAL LOADING WITH SERVICE - Clean and simple
   */
  const loadMusicians = async (isLoadingMore = false) => {
    try {
      if (!isLoadingMore) {
        setLoading(true);
        setError(null);
        console.log('🎵 Loading initial musicians...');
      } else {
        setLoadingMore(true);
        console.log('🎵 Loading more musicians...');
      }

      let newMusicians = [];

      if (isLoadingMore) {
        // ✅ LOAD MORE - Use service pagination
        newMusicians = await loadMoreMusicians(currentUser, musicians);
        setMusicians(newMusicians);
      } else {
        // ✅ INITIAL LOAD - Use service
        newMusicians = await loadMusiciansForCards(currentUser, { 
          batchSize: 5,
          resetData: true 
        });
        setMusicians(newMusicians);
        setCurrentIndex(0);
        setCurrentVideoIndex(0);
      }

      if (newMusicians.length === 0) {
        setError('No musicians found. Please try again.');
        return;
      }

      // ✅ INITIALIZE DECK ANIMATIONS
      if (!isLoadingMore) {
        initializeDeckAnimations();
      }

      console.log(`✅ Successfully loaded ${newMusicians.length} musicians`);

    } catch (error) {
      console.error('❌ Error loading musicians:', error);
      setError(handleError(error, 'MatchScreen/loadMusicians'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /**
   * ✅ LOAD WITH FILTERS - Future-ready
   */
  const loadMusiciansWithFiltersApplied = async (filters) => {
    try {
      setLoading(true);
      console.log('🔍 Loading musicians with filters:', filters);
      
      const filteredMusicians = await loadMusiciansWithFilters(currentUser, filters);
      
      if (filteredMusicians.length > 0) {
        setMusicians(filteredMusicians);
        setCurrentIndex(0);
        setCurrentVideoIndex(0);
        initializeDeckAnimations();
      } else {
        Alert.alert('No Results', 'No musicians found matching your filters.');
      }
      
    } catch (error) {
      console.error('❌ Error loading filtered musicians:', error);
      setError('Failed to load filtered musicians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ DECK ANIMATIONS - Fixed initialization
   */
  const initializeDeckAnimations = () => {
    deckAnimations.forEach((anim, index) => {
      const scaleValue = 1 - (index * DECK_CONFIG.CARD_SCALE_FACTOR);
      const translateYValue = index * DECK_CONFIG.CARD_OFFSET_Y;
      
      anim.scale.setValue(scaleValue);
      anim.translateY.setValue(translateYValue);
      anim.opacity.setValue(1);
    });
    console.log('🎴 Deck animations initialized for', DECK_CONFIG.VISIBLE_CARDS, 'cards');
  };

  const updateDeckAnimations = () => {
    deckAnimations.forEach((anim, index) => {
      const scaleValue = 1 - (index * DECK_CONFIG.CARD_SCALE_FACTOR);
      const translateYValue = index * DECK_CONFIG.CARD_OFFSET_Y;
      
      Animated.parallel([
        Animated.timing(anim.scale, { toValue: scaleValue, duration: 300, useNativeDriver: true }),
        Animated.timing(anim.translateY, { toValue: translateYValue, duration: 300, useNativeDriver: true }),
        Animated.timing(anim.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  // ✅ LOAD MORE WHEN RUNNING LOW
  const checkAndLoadMore = () => {
    const remainingCards = musicians.length - currentIndex - 1;
    if (remainingCards <= 2 && !loadingMore) {
      console.log(`🔄 Running low on cards (${remainingCards} remaining), loading more...`);
      loadMusicians(true);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadMusicians();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentVideoIndex(0);
    // Force re-render when currentIndex changes
    if (musicians[currentIndex]) {
      console.log(`🎴 Current card: ${musicians[currentIndex].username} (${currentIndex + 1}/${musicians.length})`);
    }
  }, [currentIndex, musicians]);

  const currentMusician = musicians[currentIndex];

  /**
   * ✅ IMPROVED VIDEO SIDE TAP NAVIGATION
   */
  const handleVideoSideTap = (side) => {
    if (!currentMusician?.videos || currentMusician.videos.length <= 1) {
      console.log('⚠️ Single video - no navigation needed');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (side === 'left') {
      setCurrentVideoIndex(prev => 
        prev > 0 ? prev - 1 : currentMusician.videos.length - 1
      );
    } else if (side === 'right') {
      setCurrentVideoIndex(prev => 
        prev < currentMusician.videos.length - 1 ? prev + 1 : 0
      );
    }
    
    console.log(`🎥 Video navigation: ${side} -> Video ${currentVideoIndex + 1}/${currentMusician.videos.length}`);
  };

  /**
   * ✅ PAN RESPONDER - Tinder-style gestures
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: () => {
        translateX.stopAnimation();
        translateY.stopAnimation();
        rotation.stopAnimation();
        scale.stopAnimation();
      },

      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        translateX.setValue(dx);
        translateY.setValue(dy);
        
        const rotationValue = dx / width * 0.4;
        rotation.setValue(rotationValue);
        
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scaleValue = Math.max(0.92, 1 - distance / (width * 2));
        scale.setValue(scaleValue);
        
        const maxDistance = width * 0.8;
        const opacityValue = Math.max(0.3, 1 - distance / maxDistance);
        opacity.setValue(opacityValue);
      },

      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy, vx, vy } = gestureState;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = Math.sqrt(vx * vx + vy * vy);
        
        const finalX = evt.nativeEvent.pageX;
        const isHighVelocity = velocity > SWIPE_ZONES.VELOCITY_THRESHOLD;
        const isSignificantDistance = distance > SWIPE_ZONES.MIN_DISTANCE;
        
        if (isHighVelocity || isSignificantDistance) {
          if (finalX < SWIPE_ZONES.LEFT_ZONE || (isHighVelocity && vx < -SWIPE_ZONES.VELOCITY_THRESHOLD)) {
            handleSwipeLeft();
          } else if (finalX > SWIPE_ZONES.RIGHT_ZONE || (isHighVelocity && vx > SWIPE_ZONES.VELOCITY_THRESHOLD)) {
            handleSwipeRight();
          } else {
            resetCard();
          }
        } else {
          resetCard();
        }
      },
    })
  ).current;

  const resetCard = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(rotation, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
  };

  /**
   * ✅ SWIPE HANDLERS - Tinder-style behavior
   */
  const handleSwipeRight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.parallel([
      Animated.timing(translateX, { toValue: width * 1.5, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -height * 0.1, duration: 300, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: 0.5, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      console.log('💕 User swiped RIGHT - Future: Navigate to MessageScreen with:', currentMusician?.username || currentMusician?.user || 'unknown');
      
      // ✅ FUTURE: MessageScreen navigation
      // navigation.navigate('MessageScreen', { 
      //   recipient: currentMusician,
      //   chatType: 'match',
      //   matchedFrom: 'cards'
      // });
      
      onSwipeRight && onSwipeRight(currentMusician);
      moveToNextMusician();
    });
  };

  const handleSwipeLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.parallel([
      Animated.timing(translateX, { toValue: -width * 1.5, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -height * 0.1, duration: 300, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: -0.5, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      console.log('❌ User swiped LEFT - Pass on:', currentMusician?.username || currentMusician?.user || 'unknown');
      onSwipeLeft && onSwipeLeft(currentMusician);
      moveToNextMusician();
    });
  };

  /**
   * ✅ MOVE TO NEXT MUSICIAN - Auto-stop video + load more check
   */
  const moveToNextMusician = () => {
    // Auto-stop current video before moving
    if (videoRef.current) {
      setPaused(true);
      console.log('🎥 Auto-stopped video before next card');
    }

    if (currentIndex < musicians.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCurrentVideoIndex(0);
      resetCard();
      updateDeckAnimations();
      checkAndLoadMore();
      
      // Auto-play new video after brief delay
      setTimeout(() => {
        setPaused(false);
        console.log('🎥 Auto-started new video');
      }, 300);
    } else {
      // No more musicians - load more instead of reloading completely
      console.log('🔄 Loading more musicians...');
      loadMusicians(true); // Load more, don't restart
    }
  };

  const toggleVideoPlayback = () => {
    setPaused(!paused);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const calculateDistance = () => {
    const distances = ['1.2 km', '2.5 km', '4.8 km', '6.1 km', '8.3 km'];
    return distances[Math.floor(Math.random() * distances.length)];
  };

  const renderStars = (rating = 5) => {
    return [...Array(5)].map((_, index) => (
      <Text key={index} style={styles.star}>
        {index < rating ? '⭐' : '☆'}
      </Text>
    ));
  };

  const renderGenreTags = () => {
    if (!currentMusician?.genres || currentMusician.genres.length === 0) return null;
    
    return (
      <View style={styles.genreTags}>
        {currentMusician.genres.slice(0, 2).map((genre, index) => (
          <View key={index} style={styles.genreTag}>
            <Text style={styles.genreTagText}>{genre}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderInstruments = () => {
    if (!currentMusician?.instruments) return null;
    
    // Fix: Handle instruments as object, array, or string
    let instrumentList = [];
    
    if (Array.isArray(currentMusician.instruments)) {
      instrumentList = currentMusician.instruments;
    } else if (typeof currentMusician.instruments === 'object' && currentMusician.instruments !== null) {
      instrumentList = Object.keys(currentMusician.instruments);
    } else if (typeof currentMusician.instruments === 'string') {
      instrumentList = [currentMusician.instruments];
    }
    
    // Filter out any invalid values
    instrumentList = instrumentList.filter(instrument => 
      instrument && typeof instrument === 'string' && instrument.length > 0
    );
    
    if (instrumentList.length === 0) return null;
    
    return (
      <View style={styles.instrumentsContainer}>
        {instrumentList.slice(0, 3).map((instrument, index) => (
          <View key={index} style={styles.instrumentTag}>
            <Text style={styles.instrumentTagText}>{String(instrument)}</Text>
          </View>
        ))}
        {instrumentList.length > 3 && (
          <Text style={styles.moreInstruments}>+{instrumentList.length - 3} more</Text>
        )}
      </View>
    );
  };

  /**
   * ✅ IMPROVED VIDEO CONTAINER WITH BETTER TAP ZONES
   */
  const renderVideoContainer = () => {
    const hasMultipleVideos = currentMusician?.videos && currentMusician.videos.length > 1;
    const currentVideoUrl = currentMusician?.videos?.[currentVideoIndex];
    const videoCount = currentMusician?.videos?.length || 0;

    return (
      <View style={styles.videoContainer}>
        {/* Main Video */}
        {currentVideoUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: currentVideoUrl }}
            style={styles.video}
            resizeMode="cover"
            shouldPlay={!paused}
            isLooping
            isMuted={false}
          />
        ) : (
          <View style={styles.noVideoContainer}>
            <Ionicons name="musical-notes" size={60} color="#ccc" />
            <Text style={styles.noVideoText}>No videos available</Text>
          </View>
        )}

        {/* Video Navigation Zones */}
        {hasMultipleVideos && (
          <>
            <TouchableOpacity 
              style={styles.leftTapZone}
              onPress={() => handleVideoSideTap('left')}
              activeOpacity={0.2}
            >
              <View style={styles.navHint}>
                <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.7)" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.rightTapZone}
              onPress={() => handleVideoSideTap('right')}
              activeOpacity={0.2}
            >
              <View style={styles.navHint}>
                <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Center Play/Pause Zone */}
        <TouchableOpacity 
          style={[
            styles.centerTapZone,
            hasMultipleVideos ? styles.centerWithNavigation : styles.centerFullWidth
          ]}
          onPress={toggleVideoPlayback}
          activeOpacity={0.7}
        >
          {paused && (
            <View style={styles.playButtonContainer}>
              <Ionicons name="play" size={40} color="rgba(255,255,255,0.9)" />
            </View>
          )}
        </TouchableOpacity>

        {/* Video Info Overlays */}
        {renderGenreTags()}
        
        <View style={styles.distanceContainer}>
          <Text style={styles.distanceText}>{calculateDistance()}</Text>
        </View>

        {/* ✅ CLEAN VIDEO COUNTER - Only when multiple videos */}
        {hasMultipleVideos && (
          <View style={styles.videoCounterContainer}>
            <View style={styles.videoDots}>
              {currentMusician.videos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentVideoIndex && styles.activeDot
                  ]}
                />
              ))}
            </View>
            
            <View style={styles.videoCounter}>
              <Text style={styles.videoCounterText}>
                {currentVideoIndex + 1}/{videoCount}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  /**
   * ✅ RENDER CARD DECK - Shows REAL data for all cards
   */
  const renderCardDeck = () => {
    // Get visible cards starting from currentIndex
    const visibleCards = musicians.slice(currentIndex, currentIndex + DECK_CONFIG.VISIBLE_CARDS);
    
    if (visibleCards.length === 0) {
      return null;
    }
    
    return visibleCards.map((musician, index) => {
      const isCurrentCard = index === 0;
      const globalIndex = currentIndex + index;
      
      // Ensure musician has required data
      if (!musician || !musician.username) {
        return null;
      }
      
      if (isCurrentCard) {
        // ✅ CURRENT CARD - Full interactive content
        return (
          <Animated.View
            key={`current-card-${musician.username}-${globalIndex}`}
            style={[
              styles.card,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate: rotation.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ['-30deg', '30deg']
                  })}
                ],
                opacity,
                zIndex: DECK_CONFIG.VISIBLE_CARDS - index,
              },
            ]}
            {...panResponder.panHandlers}
          >
            {renderVideoContainer()}
            {renderProfileSection()}
          </Animated.View>
        );
      } else {
        // ✅ BACKGROUND CARDS - Real preview data
        const deckAnim = deckAnimations[index];
        if (!deckAnim) return null;
        
        return (
          <Animated.View
            key={`deck-card-${musician.username}-${globalIndex}`}
            style={[
              styles.card,
              {
                transform: [
                  { scale: deckAnim.scale },
                  { translateY: deckAnim.translateY },
                  { translateX: index * DECK_CONFIG.CARD_OFFSET_X },
                ],
                opacity: deckAnim.opacity,
                zIndex: DECK_CONFIG.VISIBLE_CARDS - index,
              },
            ]}
          >
            {/* Real preview content */}
            <View style={styles.deckCardPreview}>
              {/* Video preview */}
              <View style={styles.deckVideoContainer}>
                {musician.videos && musician.videos[0] ? (
                  <Video
                    source={{ uri: musician.videos[0] }}
                    style={styles.deckVideo}
                    resizeMode="cover"
                    shouldPlay={false}
                    isMuted={true}
                  />
                ) : (
                  <View style={styles.deckVideoPlaceholder}>
                    <Ionicons name="musical-notes" size={40} color="#999" />
                  </View>
                )}
              </View>
              
              {/* Profile preview */}
              <View style={styles.deckCardInfo}>
                <Text style={styles.deckCardUsername}>@{musician.username}</Text>
                {musician.instruments && (
                  <Text style={styles.deckCardInstruments}>
                    {(() => {
                      let instrumentList = [];
                      if (Array.isArray(musician.instruments)) {
                        instrumentList = musician.instruments;
                      } else if (typeof musician.instruments === 'object' && musician.instruments !== null) {
                        instrumentList = Object.keys(musician.instruments);
                      } else if (typeof musician.instruments === 'string') {
                        instrumentList = [musician.instruments];
                      }
                      return instrumentList.filter(i => i && typeof i === 'string').slice(0, 2).join(', ');
                    })()}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        );
      }
    }).filter(card => card !== null); // Remove any null cards
  };

  /**
   * ✅ RENDER PROFILE SECTION
   */
  const renderProfileSection = () => (
    <View style={styles.profileSection}>
      <View style={styles.userInfoRow}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle-outline" size={32} color="#666" />
        </View>
        <Text style={styles.username}>@{currentMusician.username}</Text>
        <Text style={styles.ageLocation}>
          {currentMusician.age && `${currentMusician.age} • `}{currentMusician.location}
        </Text>
      </View>

      <View style={styles.ratingContainer}>
        {renderStars(currentMusician.rating)}
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.bioText} numberOfLines={2}>
          {currentMusician.bio || 'Music enthusiast looking to connect!'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="musical-notes-outline" size={20} color="#666" />
        {renderInstruments()}
      </View>

      {currentMusician.socialLink && (
        <View style={styles.infoRow}>
          <Ionicons name="link-outline" size={20} color="#666" />
          <Text style={styles.infoText}>{currentMusician.socialLink}</Text>
        </View>
      )}

      <View style={styles.counterContainer}>
        <Text style={styles.counterText}>
          {currentIndex + 1} of {musicians.length}
        </Text>
        {loadingMore && (
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        )}
      </View>

      <View style={styles.swipeHint}>
        <Text style={styles.swipeHintText}>← Pass • Message →</Text>
      </View>
    </View>
  );

  // ✅ LOADING STATES
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.button.secondary} />
        <Text style={styles.loadingText}>Finding amazing musicians...</Text>
        <Text style={styles.loadingSubText}>Loading profiles...</Text>
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMusicians()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  if (!musicians || musicians.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No musicians found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadMusicians()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  if (!currentMusician) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Loading more musicians...</Text>
        <ActivityIndicator size="large" color="#ff6ec4" style={{ marginTop: 20 }} />
        
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ FILTER BUTTON */}
      {showFilterButton && (
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => navigation.navigate('Filter')}
          activeOpacity={0.8}
        >
          <Ionicons name="options-outline" size={24} color="#fff" />
          {appliedFilters && (
            <View style={styles.filterIndicator}>
              <Text style={styles.filterIndicatorText}>!</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ✅ CARD DECK - Multiple visible cards with REAL data */}
      <View style={styles.deckContainer}>
        {renderCardDeck()}
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
        <BottomNavigation />
      </View>
    </View>
  );
};

// ✅ COMPLETE IMPROVED STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // ✅ FILTER BUTTON
  filterButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  filterIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff6ec4',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // ✅ DECK CONTAINER
  deckContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  
  // ✅ IMPROVED CARD STYLES
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  
  // ✅ DECK CARD PREVIEW WITH REAL CONTENT
  deckCardPreview: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  deckVideoContainer: {
    height: VIDEO_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  deckVideo: {
    width: '100%',
    height: '100%',
  },
  deckVideoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckCardInfo: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckCardUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deckCardInstruments: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  
  // ✅ VIDEO CONTAINER STYLES
  videoContainer: {
    height: VIDEO_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  noVideoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  
  // ✅ IMPROVED TAP ZONES
  leftTapZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '30%',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    zIndex: 5,
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
    zIndex: 5,
  },
  centerTapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  centerWithNavigation: {
    left: '30%',
    right: '30%',
  },
  centerFullWidth: {
    left: 0,
    right: 0,
  },
  
  // ✅ NAVIGATION HINTS
  navHint: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  
  // ✅ IMPROVED PLAY BUTTON
  playButtonContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 35,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  
  // ✅ OVERLAYS
  genreTags: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    gap: 8,
    zIndex: 5,
  },
  genreTag: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  distanceContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  distanceText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  
  // ✅ CLEAN VIDEO COUNTER
  videoCounterContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  videoDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ scale: 1.2 }],
  },
  videoCounter: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  videoCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ✅ PROFILE SECTION
  profileSection: {
    flex: 1,
    padding: 24,
    paddingTop: 20,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarContainer: {
    marginRight: 12,
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  ageLocation: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  star: {
    fontSize: 16,
    marginRight: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingRight: 8,
  },
  bioText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  instrumentsContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  instrumentTag: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  instrumentTagText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  moreInstruments: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  counterContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  counterText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  loadingMoreText: {
    fontSize: 11,
    color: '#ff6ec4',
    marginTop: 4,
    fontWeight: '500',
  },
  swipeHint: {
    marginTop: 12,
    alignItems: 'center',
    opacity: 0.7,
  },
  swipeHintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  
  // ✅ LOADING AND ERROR STATES
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    color: '#333',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubText: {
    color: '#666',
    marginTop: 5,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: '#ff4458',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#ff6ec4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#ff6ec4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // ✅ BOTTOM NAVIGATION
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
    zIndex: 10,
  },
});

export default MatchScreen;
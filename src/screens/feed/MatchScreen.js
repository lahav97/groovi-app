import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { 
  loadMusiciansForCards, 
  loadMoreMusicians,
} from '../../services/loadMusicianService';

import BottomNavigation from '../../components/navigationBar/BottomNavigation';
import { LAYOUT } from '../../styles/theme';
import { COLORS } from '../../styles/theme';

const { width, height } = Dimensions.get('window');

const CARD_WIDTH = width - 32;
const CARD_HEIGHT = height * 0.78;
const VIDEO_HEIGHT = CARD_HEIGHT * 0.55;

// CARD DECK CONSTANTS FOR PHASE 3
const DECK_SIZE = 3; // Show 3 cards in deck
const CARD_SCALE_OFFSET = -0.005; // More visible scaling difference
const CARD_Y_OFFSET = 3; // More visible offset
const CARD_X_OFFSET = 6; // Slight horizontal offset for depth

const MatchScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  
  // MINIMAL STATE - Keep exactly as working version
  const [musicians, setMusicians] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const currentUser = 'lahav97';

  // Keep current musician logic
  const currentMusician = musicians[currentIndex];
  
  // Only log if we have current musician to avoid spam
  if (currentMusician) {
    console.log('🚨 MATCH SCREEN RENDER:', {
      hasCurrentMusician: !!currentMusician,
      currentIndex,
      musiciansLength: musicians.length,
      username: currentMusician?.username,
    });
  }

  // SIMPLE LOAD FUNCTION - Keep exactly as working + add data validation
  const loadMusicians = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🎵 Loading musicians...');

      const newMusicians = await loadMusiciansForCards(currentUser, { 
        batchSize: 5,
        resetData: true 
      });

      if (newMusicians.length === 0) {
        setError('No musicians found. Please try again.');
        return;
      }

      // VALIDATE DATA TO PREVENT CACHE ISSUES
      const validatedMusicians = newMusicians.map((musician, index) => {
        console.log(`🔍 Validating musician ${index}:`, {
          username: musician.username,
          instrumentsType: typeof musician.instruments,
          instruments: musician.instruments,
          genresType: typeof musician.genres,
          genres: musician.genres,
        });
        
        return {
          ...musician,
          // Ensure critical fields are never objects when they should be strings
          username: formatField(musician.username, `musician_${index}`),
          bio: musician.bio, // Keep as-is, we handle in render
          location: musician.location, // Keep as-is, we handle in render
          age: musician.age, // Keep as-is, we handle in render
          rating: musician.rating,
          instruments: musician.instruments, // Keep as-is, formatInstruments handles it
          genres: musician.genres, // Keep as-is, formatField handles it
          videos: musician.videos || [],
        };
      });

      setMusicians(validatedMusicians);
      setCurrentIndex(0);
      setCurrentVideoIndex(0);

      console.log(`✅ Loaded ${validatedMusicians.length} musicians:`, validatedMusicians.map(m => ({
        username: m.username,
        hasAge: !!m.age,
        hasBio: !!m.bio,
        hasRating: !!m.rating,
        instrumentsType: typeof m.instruments,
      })));

    } catch (error) {
      console.error('❌ Error loading musicians:', error);
      setError('Failed to load musicians. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMusicians();
  }, []);

  // SIMPLE SWIPE FUNCTIONS - Keep exactly as working
  const handleSwipeLeft = () => {
    console.log('❌ Swiped LEFT on:', currentMusician?.username);
    moveToNext();
  };

  const handleSwipeRight = () => {
    console.log('💕 Swiped RIGHT on:', currentMusician?.username);
    moveToNext();
  };

  const moveToNext = () => {
    console.log('➡️ Moving to next musician...');
    
    if (currentIndex < musicians.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCurrentVideoIndex(0);
      setPaused(false);
      console.log(`✅ Moved to index ${currentIndex + 1}`);
    } else {
      console.log('🔄 No more musicians, reloading...');
      loadMusicians();
    }
  };

  const toggleVideoPlayback = () => {
    setPaused(!paused);
  };

  // SIMPLE VIDEO NAVIGATION - Keep exactly as working
  const handleVideoTap = (side) => {
    if (!currentMusician?.videos || currentMusician.videos.length <= 1) return;
    
    if (side === 'left') {
      setCurrentVideoIndex(prev => 
        prev > 0 ? prev - 1 : currentMusician.videos.length - 1
      );
    } else {
      setCurrentVideoIndex(prev => 
        prev < currentMusician.videos.length - 1 ? prev + 1 : 0
      );
    }
    
    console.log(`🎥 Video ${side} -> ${currentVideoIndex + 1}/${currentMusician.videos.length}`);
  };

  // HELPER: Format instruments safely - Handle ALL data formats
  const formatInstruments = (musician) => {
    if (!musician?.instruments) return 'Guitar, Acoustic Guitar';
    
    const instruments = musician.instruments;
    
    // Handle object like {Trumpet: true, "Lead Vocals": true}
    if (typeof instruments === 'object' && !Array.isArray(instruments) && instruments !== null) {
      const keys = Object.keys(instruments);
      if (keys.length === 0) return 'No instruments listed';
      return keys.join(', ');
    }
    
    // Handle array
    if (Array.isArray(instruments)) {
      if (instruments.length === 0) return 'No instruments listed';
      return instruments.join(', ');
    }
    
    // Handle string or convert to string
    const stringValue = String(instruments).trim();
    return stringValue || 'No instruments listed';
  };

  // HELPER: Format any field safely to prevent object rendering
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

  // HELPER: Render star rating
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
            return <FontAwesome key={i} name="star" size={16} color="#FFD700" />;
          } else if (i === fullStars && hasHalfStar) {
            return <FontAwesome key={i} name="star-half-o" size={16} color="#FFD700" />;
          } else {
            return <FontAwesome key={i} name="star-o" size={16} color="#DDD" />;
          }
        })}
        <Text style={styles.ratingText}>{numRating.toFixed(1)}</Text>
      </View>
    );
  };

  // ENHANCED PROFILE SECTION with Phase 2 styling
  const renderProfileSection = (musician = currentMusician, isActive = true) => {
    if (!musician) {
      return (
        <View style={styles.profileSection}>
          <View style={styles.errorContent}>
            <Ionicons name="musical-notes-outline" size={40} color="#ccc" />
            <Text style={styles.noDataText}>No musician data</Text>
          </View>
        </View>
      );
    }

    console.log('🎨 RENDERING PROFILE FOR:', formatField(musician.username, 'Unknown'), {
      age: musician.age,
      bio: musician.bio,
      rating: musician.rating,
      instruments: musician.instruments
    });

    return (
      <View style={styles.profileSection}>
        <ScrollView 
          style={styles.profileScrollView}
          contentContainerStyle={styles.profileContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEnabled={isActive} // Only scroll on active card
        >
          {/* HEADER: USERNAME + AGE */}
          <View style={styles.profileHeader}>
            <View style={styles.usernameRow}>
              <Ionicons name="person-circle" size={24} color={COLORS?.static?.background || '#ff6ec4'} />
              <Text style={styles.username}>@{musician.username}</Text>
              {musician.age && (
                <View style={styles.ageBadge}>
                  <Text style={styles.ageText}>{musician.age}</Text>
                </View>
              )}
            </View>
            
            {/* RATING */}
            {musician.rating && renderStarRating(musician.rating)}
          </View>

          {/* BIO SECTION */}
          {musician.bio && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="chatbubble-ellipses" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                <Text style={styles.infoLabel}>About</Text>
              </View>
              <Text style={styles.bioText}>{String(musician.bio)}</Text>
            </View>
          )}

          {/* INSTRUMENTS SECTION */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="musical-notes" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
              <Text style={styles.infoLabel}>Instruments</Text>
            </View>
            <Text style={styles.infoText}>{formatInstruments(musician)}</Text>
          </View>

          {/* LOCATION SECTION */}
          {musician.location && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="location" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                <Text style={styles.infoLabel}>Location</Text>
              </View>
              <Text style={styles.infoText}>{String(musician.location)}</Text>
            </View>
          )}

          {/* RATING SECTION if not already shown */}
          {!musician.rating && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Ionicons name="star" size={20} color={COLORS?.static?.background || '#ff6ec4'} />
                <Text style={styles.infoLabel}>Rating</Text>
              </View>
              <Text style={styles.infoText}>No rating yet</Text>
            </View>
          )}

          {/* SCROLL PADDING */}
          <View style={styles.scrollPadding} />
        </ScrollView>

        {/* SWIPE BUTTONS - Only show on active card */}
        {isActive && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.passButton} onPress={handleSwipeLeft}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.likeButton} onPress={handleSwipeRight}>
              <LinearGradient
                colors={COLORS?.primaryGradient || ['#ff6ec4', '#ffc93c', '#1c92d2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.likeGradient}
              >
                <Ionicons name="heart" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ENHANCED VIDEO CONTAINER with Phase 2 styling
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
            
            
            {/* VIDEO OVERLAY GRADIENT */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.videoOverlay}
              pointerEvents="none"
            />
          </>
        ) : (
          <View style={styles.noVideoContainer}>
            <Ionicons name="musical-notes" size={60} color="#ccc" />
            <Text style={styles.noVideoText}>No video</Text>
          </View>
        )}

        {/* VIDEO TAP ZONES - Only on active card */}
        {isActive && musician?.videos && musician.videos.length > 1 && (
          <>
            <TouchableOpacity 
              style={styles.leftTapZone}
              onPress={() => handleVideoTap('left')}
            >
              <View style={styles.tapIndicator}>
                <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.rightTapZone}
              onPress={() => handleVideoTap('right')}
            >
              <View style={styles.tapIndicator}>
                <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* PLAY/PAUSE - Only on active card */}
        {isActive && (
          <TouchableOpacity 
            style={styles.centerTapZone}
            onPress={toggleVideoPlayback}
          >
            {paused && (
              <View style={styles.playButton}>
                <Ionicons name="play" size={40} color="white" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* VIDEO COUNTER - Only on active card */}
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

  // PHASE 3: RENDER SINGLE CARD with better stacking visibility
  const renderCard = (musician, index, isActive = false) => {
    if (!musician) return null;
    
    const cardIndex = index - currentIndex;
    const scale = 1 - (cardIndex * CARD_SCALE_OFFSET);
    const translateY = cardIndex * CARD_Y_OFFSET;
    const translateX = cardIndex * CARD_X_OFFSET + 30; // Add horizontal offset
    const opacity = cardIndex === 0 ? 1 : 0.6; // More contrast between cards
    
    return (
      <View
        key={`${musician.username}-${index}-${cardIndex}`} 
        style={[
          styles.card,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            transform: [
              { scale },
              { translateY },
              { translateX },
            ],
            opacity,
            zIndex: DECK_SIZE - cardIndex,
          }
        ]}
        pointerEvents={isActive ? 'auto' : 'none'} // Only active card responds to touches
      >
        {renderVideoContainer(musician, isActive ? currentVideoIndex : 0, isActive)}
        {renderProfileSection(musician, isActive)}
      </View>
    );
  };

  // PHASE 3: RENDER CARD DECK with debugging
  const renderCardDeck = () => {
    const visibleCards = [];
    
    console.log('🃏 Rendering card deck:', {
      currentIndex,
      musiciansLength: musicians.length,
      deckSize: DECK_SIZE
    });
    
    // Show current card + next cards in deck
    for (let i = 0; i < DECK_SIZE && (currentIndex + i) < musicians.length; i++) {
      const musicianIndex = currentIndex + i;
      const musician = musicians[musicianIndex];
      const isActive = i === 0; // Only first card is active
      
      console.log(`🃏 Card ${i}: ${musician?.username}, active: ${isActive}`);
      
      if (musician) {
        visibleCards.push(
          renderCard(musician, musicianIndex, isActive)
        );
      }
    }
    
    console.log(`🃏 Total visible cards: ${visibleCards.length}`);
    return visibleCards;
  };

  // LOADING STATE - Keep as working version but enhance styling
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#ff6ec4" />
          <Text style={styles.loadingText}>Loading musicians...</Text>
          <Text style={styles.loadingSubtext}>Discover your next musical connection</Text>
        </View>
        <View style={[styles.bottomNavContainer, { height: LAYOUT.navHeight, bottom: insets.bottom }]}>
          <BottomNavigation />
        </View>
      </View>
    );
  }

  // ERROR STATE - Keep as working version but enhance styling
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorCard}>
          <Ionicons name="musical-notes-outline" size={60} color="#ccc" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMusicians}>
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

  // NO MUSICIANS - Keep as working version
  if (!musicians || musicians.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorCard}>
          <Ionicons name="search" size={60} color="#ccc" />
          <Text style={styles.errorText}>No musicians found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMusicians}>
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

  // NO CURRENT MUSICIAN - Keep as working version
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

  // MAIN RENDER - Phase 3: Card deck instead of single card
  return (
    <View style={styles.container}>
      {/* PHASE 3: CARD DECK */}
      <View style={styles.cardDeckContainer}>
        {renderCardDeck()}
      </View>

      {/* FLOATING COUNTER */}
      <View style={styles.floatingCounter}>
        <Text style={styles.floatingCounterText}>
          {currentIndex + 1} of {musicians.length}
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
    paddingTop: 40, // Add top padding to see cards better
  },
  
  // PHASE 3: CARD DECK CONTAINER - Better positioning
  cardDeckContainer: {
    width: CARD_WIDTH + 60, // Extra space for stacked cards
    height: CARD_HEIGHT + 60, // Extra space for stacked cards
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
  },
  
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 40, // Enhanced radius
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 }, // Enhanced shadow
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
    overflow: 'hidden',
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
  
  // PHASE 2: VIDEO OVERLAY
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
    backgroundColor: '#f5f5f5', // Enhanced color
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
  
  // PHASE 2: ENHANCED TAP INDICATORS
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
  
  // PROFILE SECTION - ENHANCED WITH SCROLLING
  profileSection: {
    flex: 1,
    backgroundColor: '#FFFFFF', // FORCE WHITE - Keep as working
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
    height: 80, // Space for buttons
  },
  
  // PHASE 2: PROFILE HEADER
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
  
  // PHASE 2: STAR RATING
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
  
  // PHASE 2: INFO CARDS
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
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  
  passButton: {
    backgroundColor: '#ff4757',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#ff6ec4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  
  likeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // FLOATING COUNTER - Repositioned for smaller cards
  floatingCounter: {
    position: 'absolute',
    top: 40,
    right: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  
  floatingCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // LOADING STATES
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
  
  // ERROR STATES
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
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { Video } from 'expo-av';
import BottomNavigation from '../components/navigation/BottomNavigation';
import { COLORS, SIZES, LAYOUT } from '../styles/theme';
import { useIsFocused } from '@react-navigation/native';
import Swiper from 'react-native-swiper';

const { width } = Dimensions.get('window');

const mockVideos = [
  { id: '1', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_1.mp4' },
  { id: '2', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_2.mp4' },
  { id: '3', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_3.mp4' },
  { id: '4', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_4.mp4' },
  { id: '5', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_5.mp4' },
  { id: '6', uri: 'https://groovitest.s3.amazonaws.com/Yaniv_Zamir_6.mp4' },
];

const ProfileScreen = () => {
  const [pausedStatus, setPausedStatus] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? COLORS.dark : COLORS.light;
  const isFocused = useIsFocused();
  const videoRefs = useRef({});
  const swiperRef = useRef(null);

  const togglePause = (id) => {
    setPausedStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!isFocused) {
      // Pause all videos when screen is not focused
      Object.values(videoRefs.current).forEach(ref => {
        if (ref?.pauseAsync) {
          ref.pauseAsync();
        }
      });
    }
  }, [isFocused]);

  const onIndexChanged = (index) => {
    setCurrentIndex(index);
    
    // Pause all videos except the current one
    mockVideos.forEach(video => {
      if (video.id !== mockVideos[index].id && videoRefs.current[video.id]?.pauseAsync) {
        videoRefs.current[video.id].pauseAsync();
      }
    });
    
    // Play the current video if it's not manually paused
    if (!pausedStatus[mockVideos[index].id] && videoRefs.current[mockVideos[index].id]?.playAsync) {
      videoRefs.current[mockVideos[index].id].playAsync();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Icons */}
      <View style={styles.topIcons}>
        <TouchableOpacity>
          <Ionicons name="settings-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="create-outline" size={SIZES.icon} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: LAYOUT.navHeight + 30 }]}>
        {/* Video Swiper */}
        <View style={styles.videoContainer}>
          <Swiper
            ref={swiperRef}
            style={styles.swiper}
            showsPagination={true}
            loop={false}
            onIndexChanged={onIndexChanged}
            dotStyle={styles.dot}
            activeDotStyle={styles.activeDot}
            paginationStyle={styles.pagination}
          >
            {mockVideos.map((video) => (
              <TouchableOpacity 
                key={video.id} 
                style={styles.videoWrapper} 
                onPress={() => togglePause(video.id)}
                activeOpacity={0.9}
              >
                <Video
                  ref={(ref) => { videoRefs.current[video.id] = ref; }}
                  source={{ uri: video.uri }}
                  style={styles.video}
                  resizeMode="cover"
                  isLooping
                  shouldPlay={!pausedStatus[video.id] && isFocused && currentIndex === mockVideos.findIndex(v => v.id === video.id)}
                  isMuted={false}
                />
              </TouchableOpacity>
            ))}
          </Swiper>
        </View>

        <View style={styles.usernameSection}>
          <Ionicons name="person-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.username, { color: theme.text }]}>@Yaniv.Zamir</Text>
        </View>

        <View style={styles.stars}>
          {[...Array(5)].map((_, i) => (
            <FontAwesome key={i} name="star" size={SIZES.iconSmall || 16} color="gold" />
          ))}
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="information-circle-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>I love to play the guitar !!</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="musical-notes-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>Guitar, Acustic Guitar</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>Tel Aviv</Text>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="link-outline" size={SIZES.icon} color={theme.text} />
          <Text style={[styles.infoText, { color: theme.text }]}>@social_link</Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <BottomNavigation />
      </View>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
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
  videoContainer: {
    height: 400,
    marginBottom: 20,
  },
  swiper: {
    height: 400,
  },
  videoWrapper: {
    width: '100%',
    height: 400,
  },
  video: {
    width: width - 40, // Account for horizontal padding
    height: 400,
    borderRadius: SIZES.radius,
    backgroundColor: '#111',
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
  usernameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: SIZES.font.large,
    fontWeight: '600',
    marginLeft: 10,
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: SIZES.font.medium,
    marginLeft: 10,
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
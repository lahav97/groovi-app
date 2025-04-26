 /**
 * @module ProfileSetupScreen
 * Screen for users to complete their profile by adding location, bio, video, and favorite genres.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useColorScheme,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../context/SignupFlowContext';
import { Auth } from 'aws-amplify';



const predefinedGenres = ['Pop', 'Rock', 'Jazz', 'Hip Hop', 'Classical', 'Electronic', 'R&B'];

 /**
 * @function ProfileSetupScreen
 * @description Final step of user registration, collecting personal details and video upload.
 * @returns {JSX.Element}
 */
const ProfileSetupScreen = () => {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const builder = useSignupBuilder();
  const [location, setLocation] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [bio, setBio] = useState('');
  const [video, setVideo] = useState(null);
  const [genres, setGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');
  const [videoError, setVideoError] = useState('false');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUseManualLocation(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync(loc.coords);
      const city = address[0]?.city || '';
      setLocation(city);
    })();
  }, []);

   /**
   * @function pickVideo
   * @description Opens the device library to pick a video under 40 seconds.
   */
  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert("Permission required", "Please allow access to media library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
      videoMaxDuration: 40,
    });

    if (!result.canceled && result.assets.length > 0) {
      const SelectedVideo = result.assets[0];
      if (SelectedVideo.duration && SelectedVideo.duration > 40000) {
        setVideoError('Video is too long. Please choose one under 40 seconds.');
        return;
      }

      setVideo(result.assets[0]);
      setVideoError('');
    }
  };

   /**
   * @function toggleGenre
   * @description Toggles a music genre in the selected genres list.
   * @param {string} genre - The genre to toggle.
   */
  const toggleGenre = (genre) => {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

   /**
   * @function isFormComplete
   * @description Checks if all required profile fields are filled.
   * @returns {boolean}
   */
  const isFormComplete = () => {
    const hasLocation = useManualLocation ? manualLocation : location;
    return hasLocation && bio.trim() && video && genres.length > 0;
  };

   /**
   * @function handleContinue
   * @description Builds the final user profile object and navigates to Feed screen.
   */
  const handleContinue = async () => {
    if (!isFormComplete()) return;
  
    const finalLocation = useManualLocation ? manualLocation : location;
  
    const user = builder
      .setLocation(finalLocation)
      .setBio(bio)
      .setVideos([video])
      .setGenres(genres)
      .build();
  
    console.log('🚀 Final user:', user);
  
    try {
      // TODO: Here you will later send the data to your backend API
      /*
      await axios.post('https://your-backend-url.com/api/profile', {
        username: user.username,
        location: user.location,
        bio: user.bio,
        genres: user.genres,
        videoUri: user.videos[0]?.uri,
      });
      */
  
      console.log('✅ Successfully sent profile data to backend (TODO)');
  
      navigation.reset({
        index: 0,
        routes: [{ name: 'Feed' }],
      });
  
    } catch (error) {
      console.error('Error sending profile data:', error);
      Alert.alert('Error', error.message || 'Failed to complete profile.');
      return;
    }
  };
  
  
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
          Set up your profile
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>Location</Text>
        {useManualLocation ? (
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#222' : '#eee',
                color: isDark ? '#fff' : '#000',
              },
            ]}
            placeholder="Enter your city"
            placeholderTextColor={isDark ? '#aaa' : '#666'}
            value={manualLocation}
            onChangeText={setManualLocation}
          />
        ) : (
          <Text style={[styles.infoText, { color: isDark ? '#aaa' : '#555' }]}>
            {location || 'Detecting location...'}
          </Text>
        )}

        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
          Personal Info
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              height: 100,
              backgroundColor: isDark ? '#222' : '#eee',
              color: isDark ? '#fff' : '#000',
            },
          ]}
          placeholder="Tell us about yourself..."
          placeholderTextColor={isDark ? '#aaa' : '#666'}
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
          Upload a Video
        </Text>
        <TouchableOpacity
          style={[
            styles.uploadBtn,
            { backgroundColor: isDark ? '#222' : '#eee' },
          ]}
          onPress={pickVideo}
        >
          <Ionicons name="cloud-upload-outline" size={24} color={isDark ? '#ccc' : '#555'} />
          <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333' }}>
            Choose a video from your phone
          </Text>
        </TouchableOpacity>
        {video && (
          <Text style={[styles.infoText, { color: isDark ? '#aaa' : '#555' }]}>
            Selected: {video.name}
          </Text>
        )}
        {videoError !== '' && (
          <Text style={{ color: 'red', fontSize: 13, marginTop: 4}}>{videoError}</Text>
        )}

        <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
          Favorite Genres
        </Text>
        <View style={styles.genreContainer}>
          {predefinedGenres.map((genre) => (
            <TouchableOpacity
              key={genre}
              style={[
                styles.genreChip,
                {
                  backgroundColor: genres.includes(genre)
                    ? '#ff6ec4'
                    : isDark
                    ? '#444'
                    : '#ddd',
                },
              ]}
              onPress={() => toggleGenre(genre)}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: genres.includes(genre) ? '#fff' : isDark ? '#eee' : '#333',
                  fontWeight: genres.includes(genre) ? 'bold' : 'normal',
                }}
              >
                {genre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? '#222' : '#eee',
              color: isDark ? '#fff' : '#000',
            },
          ]}
          placeholder="Other genre (optional)"
          placeholderTextColor={isDark ? '#aaa' : '#666'}
          value={customGenre}
          onChangeText={(text) => {
            setCustomGenre(text);
            if (text.trim() && !genres.includes(text)) setGenres([...genres, text]);
          }}
        />
      </ScrollView>

      <TouchableOpacity
        disabled={!isFormComplete()}
        onPress={handleContinue}
        style={[styles.continueButton, !isFormComplete() && styles.disabledButton]}
      >
        <LinearGradient
          colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.gradient}
        >
          <Text style={styles.continueText}>CONTINUE</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 12,
  },
  backButton: {
    width: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  infoText: { fontSize: 14, marginBottom: 8 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  genreChip: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  continueButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.4,
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 30,
  },
  continueText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default ProfileSetupScreen;

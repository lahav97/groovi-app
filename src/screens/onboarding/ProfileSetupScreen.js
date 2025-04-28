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
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../context/SignupFlowContext';
import axios from 'axios';

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
  const [videoError, setVideoError] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  
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
   * @function pickProfilePicture
   * @description Opens the device library to pick and crop a profile picture
   */
  const pickProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Please allow access to media library.");
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        const pickUri = result.assets[0].uri;
        
        // Compress image if needed
        const fileInfo = await FileSystem.getInfoAsync(pickUri);
        if (fileInfo.size > 1024 * 1024) { // If larger than 1MB, compress
          const manipResult = await manipulateAsync(
            pickUri,
            [{ resize: { width: 500, height: 500 } }],
            { compress: 0.7, format: 'jpeg' }
          );
          setProfilePictureUri(manipResult.uri);
        } else {
          setProfilePictureUri(pickUri);
        }
      }
    } catch (error) {
      console.error('Error picking profile picture:', error);
      Alert.alert('Error', 'Failed to pick profile picture.');
    }
  };

  /**
   * @function pickVideo
   * @description Opens the device library to pick and crop a video, then validates the result
   */
  const pickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert("Permission required", "Please allow access to media library.");
        return;
      }

      // First allow any video selection
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true, // Enable cropping
        quality: 1,
        // No duration limit here - we'll validate after cropping
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedVideo = result.assets[0];
        
        // Validate the cropped video
        // Check duration (30 seconds = 30000 milliseconds)
        if (selectedVideo.duration && selectedVideo.duration > 30000) {
          setVideoError('Video is too long. Please edit to under 30 seconds.');
          return;
        }
        
        // Check file size
        const fileInfo = await FileSystem.getInfoAsync(selectedVideo.uri);
        const fileSizeInMB = fileInfo.size / (1024 * 1024);
        
        if (fileSizeInMB > 4) {
          setVideoError('Video exceeds 4MB size limit. Please use smaller video or crop further.');
          return;
        }
        
        // Generate thumbnail for preview
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(
            selectedVideo.uri,
            { time: 0 }
          );
          setVideoThumbnail(uri);
        } catch (e) {
          console.log("Thumbnail generation error:", e);
        }
        
        setVideo(selectedVideo);
        setVideoError('');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      setVideoError('Failed to process video. Please try again.');
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
    return hasLocation && bio.trim() && video && genres.length > 0 && profilePictureUri;
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
      .setProfilePicture(profilePictureUri)
      .build();
  
    console.log('🚀 Final user:', user);
  
    try {
     const res = await axios.post('https://3y15fvynx4.execute-api.us-east-1.amazonaws.com/default/build_profile', {
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        bio: user.bio,
        location: user.location,
        genres: user.genres,
        instruments: user.instruments,
        link: user.link,
        profilePicture: user.profilePicture,
      });

      console.log('Lambda response:', res.data);  
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
          Profile Picture
        </Text>
        
        <TouchableOpacity 
          onPress={pickProfilePicture} 
          style={[styles.profilePictureContainer, {
            backgroundColor: isDark ? '#222' : '#eee',
          }]}
        >
          {profilePictureUri ? (
            <Image 
              source={{ uri: profilePictureUri }} 
              style={styles.profilePicture} 
              resizeMode="cover"
            />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Ionicons name="person-circle-outline" size={60} color={isDark ? '#ccc' : '#555'} />
              <Text style={{ 
                fontSize: 15, 
                color: isDark ? '#ccc' : '#333', 
                marginTop: 10,
                textAlign: 'center'
              }}>
                Upload Profile Picture
              </Text>
            </View>
          )}
        </TouchableOpacity>

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
            Choose a video (max 30s, 4MB after editing)
          </Text>
        </TouchableOpacity>
        
        {videoThumbnail && (
          <View style={styles.videoPreviewContainer}>
            <Image 
              source={{ uri: videoThumbnail }} 
              style={styles.videoThumbnail} 
            />
            <Text style={[styles.infoText, { color: isDark ? '#aaa' : '#555' }]}>
              Video selected
            </Text>
          </View>
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
            if (text.trim() && !genres.includes(text) && text.trim() !== '') {
              setGenres([...genres, text.trim()]);
              setCustomGenre('');
            }
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
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginVertical: 15,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
  },
  profilePicturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 5,
  },
  videoPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  videoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 10,
  },
});

export default ProfileSetupScreen;
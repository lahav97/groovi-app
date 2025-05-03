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
import * as MediaLibrary from 'expo-media-library';
import { manipulateAsync } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import axios from 'axios';
import Button from '../../components/common/Button';

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
  const [videos, setVideos] = useState([]);
  const [genres, setGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');
  const [videoError, setVideoError] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  
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
   * @function uploadVideoToLambda
   * @description Uploads a video to AWS Lambda function.
   * @param {Object} video - The video object containing uri and other metadata.
   * @param {number} index - The index of the video in the videos array.
   * @param {string} username - The username of the user.
   */
  const uploadVideoToLambda = async (video, index, username) => {
    try {
      const fileExtension = video.fileName?.split('.').pop() || 'mp4';
      const customFileName = `${username}_${index + 1}.${fileExtension}`;
  
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', 'https://y2evj55918.execute-api.us-east-1.amazonaws.com/default/upload_file');
      xhr.setRequestHeader('file-name', customFileName);
      xhr.setRequestHeader('Content-Type', video.mimeType || 'video/mp4');
  
      const blob = await fetch(video.uri).then(res => res.blob());
      xhr.send(blob);
    } catch (err) {
      console.error('Video upload failed:', err);
    }
  };

  /**
   * @function pickVideo
   * @description Opens the device library to pick and crop a video, then validates the result
   */
  const pickVideo = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to media library.');
      return;
    }
  
    try {
      const album = await MediaLibrary.getAlbumAsync('Videos');
      const media = await MediaLibrary.getAssetsAsync({
        album: album || undefined,
        mediaType: 'video',
        first: 50,
        sortBy: [['creationTime', false]],
      });
  
      const allVideos = media.assets;
  
      const selectable = allVideos.filter((video) => {
        return !videos.find((v) => v.id === video.id);
      });
  
      if (selectable.length === 0) {
        Alert.alert('No new videos', 'You’ve already selected all available videos.');
        return;
      }
  
      const selected = [];
  
      for (const video of selectable) {
        if (selected.length >= 7 - videos.length) break;
  
        const assetInfo = await MediaLibrary.getAssetInfoAsync(video.id);
        const sizeMB = assetInfo.size / (1024 * 1024);
        const durationMs = assetInfo.duration * 1000;
  
        if (sizeMB > 4 || durationMs > 30000) continue;
  
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(
          assetInfo.uri,
          { time: 0 }
        );
  
        selected.push({
          ...assetInfo,
          thumbnail: thumbUri,
        });
      }
  
      if (selected.length === 0) {
        Alert.alert('No valid videos', 'None of the videos met the 30s / 4MB requirement.');
        return;
      }
  
      setVideos((prev) => [...prev, ...selected]);
      setVideoThumbnails((prev) => [...prev, ...selected.map((v) => v.thumbnail)]);
      setVideoError('');
    } catch (err) {
      console.error('Failed to pick from media library:', err);
      setVideoError('Could not access videos.');
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
   * @description Checks if all ad profile fields are filled.
   * @returns {boolean}
   */
  const isFormComplete = () => {
    const hasLocation = useManualLocation ? manualLocation : location;
    return hasLocation && bio.trim() && videos && genres.length > 0 && profilePictureUri;
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
      .setVideos(videos)
      .setGenres(genres)
      .setProfilePicture(profilePictureUri)
      .build();
    
    console.log('Final user object:', user);
    // ✅ Step 0: Check if user already exists
    const requestBody = {
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      password: user.password,
      phoneNumber: user.phoneNumber || '',
      userType: user.userType,
      bio: user.bio,
      location: user.location,
      genres: user.genres,
      gender: user.gender,
      instruments: user.instruments,
    };
  
    if (user.link) {
      requestBody.link = user.link;
    }
  
    // ✅ Step 1: Send user info (no video) to creation Lambda
    try {
      const res = await axios.post(
        'https://3y15fvynx4.execute-api.us-east-1.amazonaws.com/default/layertest',
        requestBody
      );
      console.log('Lambda response:', res.data);
    } catch (error) {
      console.error('Error creating user:', error);
      Alert.alert('Error', 'Failed to create user profile.');
      return;
    }
  
    // ✅ Step 2: Upload each video individually to upload Lambda
    for (let i = 0; i < videos.length; i++) {
      try {
        await uploadVideoToLambda(videos[i], i, user.username);
      } catch (error) {
        console.error('Video upload failed:', error);
        Alert.alert('Upload failed', `Could not upload video ${i + 1}`);
        return;
      }
    }
  
    // ✅ Step 3: Navigate to feed
    navigation.reset({
      index: 0,
      routes: [{ name: 'Feed' }],
    });
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
          Upload Videos
        </Text>

        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: isDark ? '#222' : '#eee' }]}
          onPress={pickVideo}
        >
          <Ionicons name="cloud-upload-outline" size={24} color={isDark ? '#ccc' : '#555'} />
          <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333' }}>
            Choose videos (max 30s / 4MB)
          </Text>
        </TouchableOpacity>

        {videoThumbnails.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 }}>
            {videoThumbnails.map((thumb, i) => (
              <View key={i} style={{ position: 'relative' }}>
                <Image
                  source={{ uri: thumb }}
                  style={{
                    width: 70,
                    height: 100,
                    borderRadius: 10,
                    backgroundColor: '#000',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: 12,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>{i + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {videoError !== '' && (
          <Text style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{videoError}</Text>
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

      <Button
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
          <Text style={styles.continueText}>Finish</Text>
        </LinearGradient>
      </Button>
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
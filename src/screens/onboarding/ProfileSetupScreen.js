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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
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
  const [videoUrls, setVideoUrls] = useState([]);
  const [genres, setGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');
  const [videoError, setVideoError] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingVideo, setCurrentUploadingVideo] = useState(null);
  const [videoCounter, setVideoCounter] = useState(0); // Persistent counter for video indices
  
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
   * @description Uploads a video to AWS Lambda function and returns the URL.
   * @param {Object} video - The video object containing uri and other metadata.
   * @param {number} index - The index of the video in the videos array.
   * @param {string} username - The username of the user.
   * @returns {Promise<string>} - A promise that resolves to the video URL.
   */
  const uploadVideoToLambda = async (video, index, username) => {
    try {
      console.log(`Uploading video ${index + 1} for user ${username}`, video);

      // Extract file extension from the filename or use default
      const fileExtension = video.fileName ? 
        video.fileName.split('.').pop() : 
        (video.uri.split('.').pop() || 'mp4');
        
      const customFileName = `${username}_${index + 1}.${fileExtension}`;
      
      console.log(`Using filename: ${customFileName}`);

      // Create a promise to track the XHR request
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.open('PUT', 'https://cy6ikxj5lk.execute-api.us-east-1.amazonaws.com/groovi/file_upload');
        xhr.setRequestHeader('file-name', customFileName);
        xhr.setRequestHeader('Content-Type', video.mimeType || 'video/mp4');
        
        // Set up event handlers for the XHR request
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log(`Video ${index + 1} uploaded successfully!`);
            // Parse the response to get the video URL
            try {
              const response = JSON.parse(xhr.responseText);
              const videoUrl = response.url || `https://groovi-videos.s3.amazonaws.com/${customFileName}`;
              console.log(`Video ${index + 1} URL: ${videoUrl}`);
              resolve(videoUrl);
            } catch (error) {
              console.error('Error parsing response:', error);
              // If parsing fails, construct a default URL based on the filename
              const fallbackUrl = `https://groovi-videos.s3.amazonaws.com/${customFileName}`;
              console.log(`Using fallback URL: ${fallbackUrl}`);
              resolve(fallbackUrl);
            }
          } else {
            console.error(`Video upload failed with status ${xhr.status}: ${xhr.responseText}`);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          console.error('XHR network error occurred during video upload');
          reject(new Error('Network error during upload'));
        };
        
        // Get the blob from the URI and send it
        fetch(video.uri)
          .then(res => res.blob())
          .then(blob => {
            xhr.send(blob);
          })
          .catch(error => {
            console.error('Error converting video URI to blob:', error);
            reject(error);
          });
      });
    } catch (err) {
      console.error('Video upload failed:', err);
      throw err; // Re-throw to be handled by the caller
    }
  };

  /**
   * @function uploadSingleVideo
   * @description Upload a single video immediately after selection
   * @param {Object} videoObj - The video object to upload
   * @returns {Promise<string>} - A promise that resolves to the video URL
   */
  const uploadSingleVideo = async (videoObj) => {
    const currentIndex = videoCounter; // Use the current counter value
    setCurrentUploadingVideo(currentIndex);
    try {
      // Get the username from the builder's current state
      const userState = builder.build();
      const username = userState.username || userState.email || `user_${Date.now()}`;
      
      // Upload the video
      const videoUrl = await uploadVideoToLambda(videoObj, currentIndex, username);
      
      // Add the URL to our state
      setVideoUrls((prevUrls) => [...prevUrls, videoUrl]);
      
      // Increment the counter after successful upload
      setVideoCounter((prevCounter) => prevCounter + 1);
      
      return videoUrl;
    } catch (error) {
      console.error(`Error uploading video ${currentIndex + 1}:`, error);
      Alert.alert('Upload Error', 'Failed to upload video. Please try again.');
      throw error;
    } finally {
      setCurrentUploadingVideo(null);
    }
  };

  /**
   * @function deleteVideo
   * @description Deletes a video uploaded by the user from S3 and updates the state.
   * @param {number} index - The index of the video to delete.
   */
  const deleteVideo = async (index) => {
    const videoToDelete = videos[index];
    if (!videoToDelete || !videoToDelete.fileName) {
      Alert.alert('Error', 'Invalid video selected for deletion.');
      return;
    }

    try {
      const fileName = videoToDelete.fileName;
      const deleteUrl = `https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/delete?filename=${fileName}`;
      console.log(`Sending DELETE request to: ${deleteUrl}`);

      const response = await axios.delete(deleteUrl);

      if (response.status === 200) {
        console.log(`Video ${fileName} deleted successfully.`);
        Alert.alert('Success', `Video ${fileName} has been deleted.`);

        // Remove the video from state
        setVideos((prev) => prev.filter((_, i) => i !== index));
        setVideoThumbnails((prev) => prev.filter((_, i) => i !== index));
        setVideoUrls((prev) => prev.filter((_, i) => i !== index));
      } else {
        console.error(`Failed to delete video ${fileName}:`, response.data);
        Alert.alert('Error', `Failed to delete video ${fileName}.`);
      }
    } catch (error) {
      console.error(`Error deleting video ${fileName}:`, error.response?.data || error.message);
      Alert.alert('Error', `Failed to delete video ${fileName}. Please try again.`);
    }
  };

  // Prevent adding the same video twice (by fileName and size)
  const isDuplicateVideo = (fileName, size) => videos.some((v) => v.fileName === fileName && v.size === size);

  // Move video left or right
  const moveVideo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= videos.length) return;
    // Move in videos
    const newVideos = [...videos];
    const [movedVideo] = newVideos.splice(fromIndex, 1);
    newVideos.splice(toIndex, 0, movedVideo);
    setVideos(newVideos);
    // Move in thumbnails
    const newThumbs = [...videoThumbnails];
    const [movedThumb] = newThumbs.splice(fromIndex, 1);
    newThumbs.splice(toIndex, 0, movedThumb);
    setVideoThumbnails(newThumbs);
    // Move in videoUrls (if already uploaded)
    const newUrls = [...videoUrls];
    const [movedUrl] = newUrls.splice(fromIndex, 1);
    newUrls.splice(toIndex, 0, movedUrl);
    setVideoUrls(newUrls);
  };

  /**
   * @function pickVideo
   * @description Opens the device library to pick a video, validate it, and upload it immediately
   */
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to media library.');
      return;
    }
  
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 1,
      });
  
      if (result.canceled || !result.assets || result.assets.length === 0) return;
  
      const selectedAsset = result.assets[0];
  
      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(selectedAsset.uri, { size: true });
      const sizeBytes = fileInfo?.size || 0;
      const sizeMB = sizeBytes / (1024 * 1024);
  
      // Prevent duplicate video (by fileName and size)
      if (isDuplicateVideo(selectedAsset.fileName, sizeBytes)) {
        Alert.alert('Duplicate Video', 'You have already added this video.');
        return;
      }
  
      // Handle duration calculation - different versions of expo-image-picker return different formats
      // Some return milliseconds, some return seconds
      let durationSec = selectedAsset?.duration || 0;
      
      // If duration is very large, it's likely in milliseconds, so convert to seconds
      if (durationSec > 100) {
        durationSec = durationSec / 1000;
      }
  
      console.log(`Video details - Size: ${sizeMB.toFixed(2)}MB, Duration: ${durationSec.toFixed(1)}s`);
  
      // Validate size and duration
      if (sizeMB > 4) {
        Alert.alert(
          'Video too large',
          `Video must be under 4MB. Your video is ${sizeMB.toFixed(2)}MB.`
        );
        return;
      }
  
      if (durationSec > 30) {
        Alert.alert(
          'Video too long',
          `Video must be under 30 seconds. Your video is ${durationSec.toFixed(1)} seconds.`
        );
        return;
      }
      
      // Get thumbnail
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(
        selectedAsset.uri,
        { time: 0 }
      );
  
      // Create video object with all required information
      const videoObj = {
        id: selectedAsset.assetId || Date.now().toString(),
        uri: selectedAsset.uri,
        fileName: selectedAsset.fileName || `video_${Date.now()}.mp4`,
        mimeType: selectedAsset.mimeType || 'video/mp4',
        duration: durationSec,
        size: sizeBytes,
        thumbnail: thumbUri,
      };
      
      // Add to state first to show in UI
      setVideos((prev) => [...prev, videoObj]);
      setVideoThumbnails((prev) => [...prev, thumbUri]);
      setVideoError('');
      
      // Now upload the video immediately
      try {
        await uploadSingleVideo(videoObj); // No need to pass index explicitly
      } catch (error) {
        // If upload fails, we keep the video in the UI but will show an error status
        console.error('Failed to upload video:', error);
        setVideoError(`Failed to upload video. You can try again or continue with the others.`);
      }
    } catch (err) {
      console.error('Failed to pick video:', err);
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
   * @description Checks if all profile fields are filled and videos are uploaded.
   * @returns {boolean}
   */
  const isFormComplete = () => {
    const hasLocation = useManualLocation ? manualLocation : location;
    // Check if all videos are uploaded by comparing lengths
    const allVideosUploaded = videos.length > 0 && videos.length === videoUrls.length;
    return hasLocation && bio.trim() && allVideosUploaded && genres.length > 0 && profilePictureUri;
  };

  /**
   * @function handleContinue
   * @description Builds the final user profile object and navigates to Feed screen.
   */
  const handleContinue = async () => {
    if (!isFormComplete()) {
      if (videos.length > videoUrls.length) {
        Alert.alert('Not all videos uploaded', 'Please wait for all videos to finish uploading.');
      }
      return;
    }
    
    setIsUploading(true);
    try {
      const finalLocation = useManualLocation ? manualLocation : location;

      // Create the complete user object with already uploaded videos
      const updatedUser = builder
        .setLocation(finalLocation)
        .setBio(bio)
        .setGenres(genres)
        .setProfilePicture(profilePictureUri)
        .setVideos(videoUrls)
        .build();
      
      console.log('Updated user data with video URLs:', updatedUser);
      
      // Create the request body with all required fields
      const requestBody = {
        username: updatedUser.username || updatedUser.email,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        password: updatedUser.password,
        phoneNumber: updatedUser.phoneNumber || "",
        userType: updatedUser.userType,
        bio: updatedUser.bio,
        location: updatedUser.location,
        genres: updatedUser.genres,
        gender: updatedUser.gender || "prefer not to say",
        instruments: updatedUser.instruments || {},
        videoUrls: videoUrls,
      };

      // Add optional fields only if they exist
      if (updatedUser.link) {
        requestBody.link = updatedUser.link;
      }

      console.log('Request body being sent to Lambda:', requestBody);

      // Send user info to creation Lambda
      const res = await axios.post(
        'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile',
        requestBody
      );
      
      console.log('Lambda response:', res.data);
      
      // Navigate to feed
      navigation.reset({
        index: 0,
        routes: [{ name: 'Feed' }],
      });
    } catch (error) {
      console.error('Error in profile setup:', error.response?.data || error.message);
      Alert.alert('Error', error.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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

        <ScrollView 
          contentContainerStyle={[
            styles.scroll,
            // Add padding at the bottom to account for the button's height
            { paddingBottom: 100 }
          ]}
        >
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
            disabled={currentUploadingVideo !== null}
          >
            {currentUploadingVideo !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={isDark ? '#ccc' : '#555'} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333' }}>
                  Uploading video {currentUploadingVideo + 1}...
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={24} color={isDark ? '#ccc' : '#555'} />
                <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333' }}>
                  Choose videos (max 30s / 4MB)
                </Text>
              </>
            )}
          </TouchableOpacity>

          {videoThumbnails.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 }}>
              {videoThumbnails.map((thumb, i) => (
                <View key={i} style={{ position: 'relative', alignItems: 'center' }}>
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
                      right: 6,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      borderRadius: 12,
                      padding: 3,
                    }}
                  >
                    {i === currentUploadingVideo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons 
                        name={i < videoUrls.length ? "checkmark-circle" : "time-outline"} 
                        size={16} 
                        color={i < videoUrls.length ? "#4caf50" : "#ff9800"} 
                      />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => moveVideo(i, i - 1)}
                      disabled={i === 0}
                      style={{ marginHorizontal: 2, opacity: i === 0 ? 0.3 : 1 }}
                    >
                      <Ionicons name="arrow-back-circle" size={22} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveVideo(i, i + 1)}
                      disabled={i === videoThumbnails.length - 1}
                      style={{ marginHorizontal: 2, opacity: i === videoThumbnails.length - 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="arrow-forward-circle" size={22} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteVideo(i)}
                      style={{ marginHorizontal: 2 }}
                    >
                      <Ionicons name="trash-bin" size={22} color="#888" />
                    </TouchableOpacity>
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

          <Button
            disabled={!isFormComplete() || isUploading}
            onPress={handleContinue}
            style={[styles.continueButton, (!isFormComplete() || isUploading) && styles.disabledButton]}
          >
            <LinearGradient
              colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.continueText}>FINISH</Text>
              )}
            </LinearGradient>
          </Button>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  scroll: { 
    padding: 20,
    paddingBottom: 60, // match InstrumentsScreen
  },
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
  infoText: { 
    fontSize: 14, 
    marginBottom: 8,
  },
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
  buttonContainer: {
  },
  continueButton: {
    marginTop: 2,
    marginBottom: 40,
    width: '100%',
    borderRadius: 30,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  continueText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
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
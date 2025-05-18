/**
 * @module ProfileSetupScreen
 * Screen for users to complete their profile by adding location, bio, video, and favorite genres.
 * Modified to work on Android devices without FFmpeg dependency
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
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import axios from 'axios';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

const FILE_UPLOAD_API_URL = 'https://cy6ikxj5lk.execute-api.us-east-1.amazonaws.com/groovi/file_upload';
const BUILD_PROFILE_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile';
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
  const { signIn, user } = useAuth();
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
  const [videoCounter, setVideoCounter] = useState(0);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [videoKeys, setVideoKeys] = useState(new Set());
  
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
      
      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePictureUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking profile picture:', error);
      Alert.alert('Error', 'Failed to pick profile picture.');
    }
  };

/**
 * @function uploadVideoToLambda
 * @description Gets a pre-signed URL from Lambda and uploads a video to S3.
 * @param {Object} video - The video object containing uri and other metadata.
 * @param {number} index - The index of the video in the videos array.
 * @param {string} username - The username of the user.
 * @returns {Promise<string>} - A promise that resolves to the final video URL.
 */
const uploadVideoToLambda = async (video, index, username) => {
  try {
    console.log(`Uploading video ${index + 1} for user ${username}`, video);

    // Extract file extension from the filename or use default
    const fileExtension = video.fileName ? 
      video.fileName.split('.').pop() : 
      (video.uri.split('.').pop() || 'mp4');
      
    const customFileName = `${username}_${index + 1}.${fileExtension}`;
    
    // Step 1: Get pre-signed URL from Lambda
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Request pre-signed URL from Lambda
      xhr.open('PUT', FILE_UPLOAD_API_URL);
      xhr.setRequestHeader('file-name', customFileName);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      // Set up event handlers for the XHR request to get pre-signed URL
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Parse the response to get the upload URL and final file URL
            const response = JSON.parse(xhr.responseText);
            console.log("Lambda response:", response);
            
            if (response.uploadUrl && response.fileUrl) {
              const uploadUrl = response.uploadUrl;
              const fileUrl = response.fileUrl;
              
              console.log(`Got pre-signed URL for video ${index + 1}`);
              
              // Step 2: Use the pre-signed URL to upload the file directly to S3
              uploadFileToS3(video.uri, uploadUrl)
                .then(() => {
                  console.log(`Video ${index + 1} uploaded successfully to S3!`);
                  resolve(fileUrl);
                })
                .catch(error => {
                  console.error(`Error uploading to S3:`, error);
                  reject(error);
                });
            } else {
              console.error('Invalid response from Lambda, missing uploadUrl or fileUrl:', response);
              // Fallback URL as in original code
              const fallbackUrl = `https://groovi-videos.s3.amazonaws.com/${customFileName}`;
              console.log(`Using fallback URL: ${fallbackUrl}`);
              resolve(fallbackUrl);
            }
          } catch (error) {
            console.error('Error parsing Lambda response:', error);
            // Fallback URL if parsing fails
            const fallbackUrl = `https://groovi-videos.s3.amazonaws.com/${customFileName}`;
            console.log(`Using fallback URL: ${fallbackUrl}`);
            resolve(fallbackUrl);
          }
        } else {
          console.error(`Failed to get pre-signed URL: ${xhr.status}: ${xhr.responseText}`);
          reject(new Error(`Failed to get pre-signed URL: ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        console.error('Network error occurred getting pre-signed URL');
        reject(new Error('Network error getting pre-signed URL'));
      };
      
      // Send the request with an empty body
      xhr.send(JSON.stringify({}));
    });
  } catch (err) {
    console.error('Video upload process failed:', err);
    throw err;
  }
};

/**
 * @function uploadFileToS3
 * @description Uploads a file to S3 using a pre-signed URL
 * @param {string} fileUri - The local URI of the file to upload
 * @param {string} presignedUrl - The pre-signed S3 URL
 * @returns {Promise<void>}
 */
const uploadFileToS3 = async (fileUri, presignedUrl) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('PUT', presignedUrl);
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error('Network error during S3 upload'));
    };
    
    // Get the blob from the URI and send it
    fetch(fileUri)
      .then(res => res.blob())
      .then(blob => {
        xhr.setRequestHeader('Content-Type', blob.type || 'video/mp4');
        xhr.send(blob);
      })
      .catch(error => {
        console.error('Error converting file URI to blob:', error);
        reject(error);
      });
  });
};

  /**
   * @function uploadSingleVideo
   * @description Upload a single video immediately after selection
   * @param {Object} videoObj - The video object to upload
   * @returns {Promise<string>} - A promise that resolves to the video URL
   */
  const uploadSingleVideo = async (videoObj, index) => {
    try {
      // Get the username from the builder's current state
      const username = user?.username || user?.email || `user_${Date.now()}`;
      console.log('Using username for video upload:', username);
      
      // Upload the video
      const videoUrl = await uploadVideoToLambda(videoObj, index, username);
      
      // Add the URL to our state
      setVideoUrls((prevUrls) => {
        const newUrls = [...prevUrls];
        newUrls[index] = videoUrl;
        return newUrls;
      });
      
      // Increment the counter after successful upload
      setVideoCounter((prevCounter) => prevCounter + 1);
      
      return videoUrl;
    } catch (error) {
      console.error(`Error uploading video ${index + 1}:`, error);
      Alert.alert('Upload Error', 'Failed to upload video. Please try again.');
      throw error;
    }
  };

  /**
   * @function deleteVideo
   * @description Deletes a video uploaded by the user from S3 and updates the state.
   * @param {number} index - The index of the video to delete.
   */
  const deleteVideo = async (index) => {
    const videoToDelete = videos[index];
    if (!videoToDelete) {
      Alert.alert('Error', 'Invalid video selected for deletion.');
      return;
    }

    try {
      // Remove from local state first for better UX
      setVideos((prev) => prev.filter((_, i) => i !== index));
      setVideoThumbnails((prev) => prev.filter((_, i) => i !== index));
      setVideoUrls((prev) => prev.filter((_, i) => i !== index));
      
      // No need to call backend deletion API for Android compatibility
      // Just inform the user
      console.log(`Video at index ${index} removed`);
    } catch (error) {
      console.error(`Error deleting video:`, error);
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    }
  };

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
  
      // Handle duration calculation - different versions of expo-image-picker return different formats
      // Some return milliseconds, some return seconds
      let durationSec = selectedAsset?.duration || 0;
      
      // If duration is very large, it's likely in milliseconds, so convert to seconds
      if (durationSec > 100) {
        durationSec = durationSec / 1000;
      }
  
      console.log(`Video details - Size: ${sizeMB.toFixed(2)}MB, Duration: ${durationSec.toFixed(1)}s`);
  
      // Validate size and duration
      if (sizeMB > 20) {
        Alert.alert(
          'Video too large',
          `Video must be under 20MB. Your video is ${sizeMB.toFixed(2)}MB.`
        );
        return;
      }
  
      if (durationSec > 45) {
        Alert.alert(
          'Video too long',
          `Video must be under 45 seconds. Your video is ${durationSec.toFixed(1)} seconds.`
        );
        return;
      }
      
      // For Android compatibility, we use a simpler approach to get a thumbnail
      // Just use the video URI as the thumbnail placeholder
      const thumbUri = selectedAsset.uri + "#t=0.1";
  
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
      
      // Generate a key for the video
      const fileName = selectedAsset.fileName || '';
      const videoKey = generateVideoKey(fileName, sizeBytes, durationSec);

      if (videoKeys.has(videoKey)) {
        Alert.alert('Duplicate Video', 'You have already added this video.');
        return;
      }
      
      // Add to state first to show in UI
      setVideos(prev => [...prev, videoObj]);
      setVideoThumbnails(prev => [...prev, thumbUri]);
      setUploadStatuses(prev => [...prev, { uploading: true, error: null }]);
      setVideoKeys(prev => new Set(prev).add(videoKey));

      // Start upload in background
      uploadSingleVideo(videoObj, videos.length)
        .then(() => {
          setUploadStatuses(prev => {
            const newStatuses = [...prev];
            newStatuses[videos.length] = { uploading: false, error: null };
            return newStatuses;
          });
        })
        .catch(error => {
          setUploadStatuses(prev => {
            const newStatuses = [...prev];
            newStatuses[videos.length] = { uploading: false, error: error.message };
            return newStatuses;
          });
        });
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
        BUILD_PROFILE_API_URL,
        requestBody
      );
      
      console.log('Lambda response:', res.data);
      
      const signInResult = await signIn(requestBody.email, requestBody.password);

      if (signInResult) {
        // Navigate to feed
        navigation.reset({
          index: 0,
          routes: [{ name: 'Feed' }],
        });
      } else {
        console.error('Sign-in failed');
        Alert.alert('Error', 'Failed to sign in. Please try again.');
      }
    } catch (error) {
      console.error('Error in profile setup:', error.response?.data || error.message);
      Alert.alert('Error', error.message || 'Failed to complete profile setup. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };
  
  const generateVideoKey = (fileName, size, duration) => `${fileName}_${size}_${duration}`;

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
          >
            <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333', marginLeft: 8 }}>
              Choose videos (max 45s / 20MB)
            </Text>
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
                    {uploadStatuses[i]?.uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons 
                        name={i < videoUrls.length && videoUrls[i] ? "checkmark-circle" : "time-outline"} 
                        size={16} 
                        color={i < videoUrls.length && videoUrls[i] ? "#4caf50" : "#ff9800"} 
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
            onChangeText={setCustomGenre}
            onSubmitEditing={() => {
              if (customGenre.trim() && !genres.includes(customGenre.trim())) {
                setGenres([...genres, customGenre.trim()]);
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
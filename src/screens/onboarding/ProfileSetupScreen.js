/**
 * @module ProfileSetupScreen
 * Screen for users to complete their profile by adding location, bio, video, and favorite genres.
 * Enhanced with upload service integration.
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
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import axios from 'axios';
import Button from '../../components/common/Button';
import AddressInput from '../../components/common/AddressInput';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUploadService } from '../../services/uploadFileService';
import { 
  processBatchVideos, 
  createVideoManager, 
  deleteVideoFromS3 
} from '../../services/videoService';
import { COLORS } from '../../styles/theme';

const BUILD_PROFILE_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile';
const predefinedGenres = ['Pop', 'Rock', 'Metal', 'Jazz', 'Hip Hop', 'Classical', 'Electronic', 'R&B'];

/**
 * @function ProfileSetupScreen
 * @description Final step of user registration, collecting personal details and video upload.
 * @returns {JSX.Element}
 */
const ProfileSetupScreen = () => {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const builder = useSignupBuilder();
  const { signIn, user, completeOnboarding } = useAuth();
  const uploadService = getUploadService(user);
  
  // Address state - now using detailed address object
  const [address, setAddress] = useState({
    street: '',
    streetNumber: '',
    city: '',
    region: '',
    country: '',
    postalCode: '',
    formattedAddress: '',
    latitude: null,
    longitude: null,
  });
  
  const [bio, setBio] = useState('');
  const [videos, setVideos] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [genres, setGenres] = useState([]);
  const [customGenre, setCustomGenre] = useState('');
  const [videoError, setVideoError] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [videoKeys, setVideoKeys] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({});

  // Create video manager instance
  const videoManager = createVideoManager(videos, videoThumbnails, videoUrls, uploadStatuses);

  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const stored = await AsyncStorage.getItem('signupBuilderBackup');
        console.log('📦 Attempting to read signupBuilderBackup from AsyncStorage...');

        if (stored) {
          const parsedUser = JSON.parse(stored);  
          builder
            .setFullName(parsedUser.fullName)
            .setUsername(parsedUser.username)
            .setEmail(parsedUser.email)
            .setPassword(parsedUser.password)
            .setUserType(parsedUser.userType)
            .setPhoneNumber(parsedUser.phoneNumber)
            .setGender(parsedUser.gender)
            .setBirthDate(parsedUser.birthDate)
            .setInstruments(parsedUser.instruments);
        } else {
          console.warn('⚠️ No stored user data found for ProfileSetupScreen');
        }
      } catch (err) {
        console.error('❌ Failed to restore user data from storage:', err);
      }
    };
  
    loadUserFromStorage();
  }, []);

  /**
   * Handle address change from AddressInput component
   */
  const handleAddressChange = (newAddress) => {
    setAddress(newAddress);
  };

  /**
   * @function pickProfilePicture
   * @description Opens the device library to pick and crop a profile picture using upload service
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
        const selectedAsset = result.assets[0];
        
        // Upload using the service
        const uploadResult = await uploadService.uploadImage(
          selectedAsset,
          'profile',
          (progress) => {
            console.log('Profile picture upload progress:', progress);
          }
        );

        if (uploadResult.success) {
          setProfilePictureUri(uploadResult.imageUrl);
        } else {
          Alert.alert('Upload Error', uploadResult.error);
          // Still show local image for preview
          setProfilePictureUri(selectedAsset.uri);
        }
      }
    } catch (error) {
      console.error('Error picking profile picture:', error);
      Alert.alert('Error', 'Failed to pick profile picture.');
    }
  };

  /**
   * @function pickVideos
   * @description Opens the device library to pick multiple videos using video service
   */
  const pickVideos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to media library.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      console.log(`Processing ${result.assets.length} selected videos...`);

      // Process videos using the video service with profile setup limits
      const processingOptions = {
        maxSizeMB: 4,  // Profile setup has stricter limits
        maxDurationSec: 30
      };

      const batchResult = await processBatchVideos(
        result.assets, 
        videoKeys, 
        processingOptions,
        (progress) => {
          console.log(`Processing video ${progress.current}/${progress.total}`);
        }
      );

      if (batchResult.success) {
        // Update state with processed videos
        batchResult.processedVideos.forEach((videoData) => {
          const newArrays = videoManager.addVideo(
            videoData,
            videoData.thumbnail,
            null, // No URL yet
            { uploading: true, uploaded: false, error: null }
          );
          
          setVideos(newArrays.videos);
          setVideoThumbnails(newArrays.thumbnails);
          setVideoUrls(newArrays.urls);
          setUploadStatuses(newArrays.statuses);
        });

        // Update video keys
        setVideoKeys(batchResult.videoKeys);

        // Start uploading each video
        batchResult.processedVideos.forEach((videoData, index) => {
          const actualIndex = videos.length + index;
          uploadSingleVideo(videoData, actualIndex);
        });

        // Show errors if any
        if (batchResult.errors.length > 0) {
          const errorMessages = batchResult.errors.map(e => e.error).join('\n');
          Alert.alert('Some videos could not be processed', errorMessages);
        }

        console.log(`✅ Processed ${batchResult.processedVideos.length} videos successfully`);
        setVideoError('');
      } else {
        Alert.alert('Error', batchResult.error || 'Failed to process videos');
        setVideoError(batchResult.error || 'Failed to process videos');
      }

    } catch (err) {
      console.error('Failed to pick videos:', err);
      setVideoError('Could not access videos.');
    }
  };

  /**
   * @function uploadSingleVideo
   * @description Upload a single video using the upload service
   */
  const uploadSingleVideo = async (videoData, index) => {
    try {
      console.log(`🚀 Starting upload for video ${index + 1}: ${videoData.fileName}`);

      // Upload using the service with progress tracking
      const uploadResult = await uploadService.uploadVideo(
        {
          uri: videoData.uri,
          fileName: videoData.fileName,
          mimeType: videoData.mimeType,
          duration: videoData.duration,
          assetId: videoData.id
        },
        videoKeys,
        index,
        (progress) => {
          console.log(`Video ${index + 1} upload progress:`, progress);
          setUploadProgress(prev => ({
            ...prev,
            [index]: progress.progress || 0
          }));
        },
        {
          maxSizeMB: 4,
          maxDurationSec: 30
        }
      );

      if (uploadResult.success) {
        // Update video with upload results using video manager
        const newArrays = videoManager.updateVideo(index, {
          videoData: uploadResult.videoData,
          url: uploadResult.videoUrl,
          status: { uploading: false, uploaded: true, error: null }
        });

        setVideos(newArrays.videos);
        setVideoUrls(newArrays.urls);
        setUploadStatuses(newArrays.statuses);

        // Update thumbnail if we got a better one
        if (uploadResult.videoData.thumbnail !== videoData.thumbnail) {
          const updatedThumbnails = videoManager.updateVideo(index, {
            thumbnail: uploadResult.videoData.thumbnail
          });
          setVideoThumbnails(updatedThumbnails.thumbnails);
        }

        console.log(`✅ Video ${index + 1} uploaded successfully: ${uploadResult.videoUrl}`);
        setVideoError('');
      } else {
        // Update status to error using video manager
        const newArrays = videoManager.updateVideo(index, {
          status: { uploading: false, uploaded: false, error: uploadResult.error }
        });
        setUploadStatuses(newArrays.statuses);
        
        setVideoError(`Failed to upload ${videoData.fileName}: ${uploadResult.error}`);
        console.error(`❌ Video ${index + 1} upload failed:`, uploadResult.error);
      }
    } catch (error) {
      console.error(`Failed to upload video ${index + 1}:`, error);
      
      // Update status to error using video manager
      const newArrays = videoManager.updateVideo(index, {
        status: { uploading: false, uploaded: false, error: error.message }
      });
      setUploadStatuses(newArrays.statuses);
      
      setVideoError(`Failed to upload video: ${error.message}`);
    }
  };

  /**
   * @function deleteVideo
   * @description Deletes a video from S3 and local state using services
   */
  const deleteVideo = async (index) => {
    const videoToDelete = videos[index];
    if (!videoToDelete) {
      Alert.alert('Error', 'Invalid video selected for deletion.');
      return;
    }

    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // If video has been uploaded, delete from S3 using video service
              if (uploadStatuses[index]?.uploaded && videoToDelete.fileName) {
                console.log(`🗑️ Deleting video from S3: ${videoToDelete.fileName}`);
                
                const deleteResult = await deleteVideoFromS3(videoToDelete.fileName);
                
                if (!deleteResult.success) {
                  console.warn(`⚠️ S3 deletion failed: ${deleteResult.error}`);
                  Alert.alert(
                    'Warning', 
                    'Video was removed locally but may still exist on server. Please contact support if needed.'
                  );
                }
              }

              // Remove from videoKeys set using upload service method
              const videoKey = uploadService.createVideoKey(
                videoToDelete.fileName || '',
                videoToDelete.size,
                videoToDelete.duration
              );
              setVideoKeys(prev => {
                const newKeys = new Set(prev);
                newKeys.delete(videoKey);
                return newKeys;
              });

              // Remove from arrays using video manager
              const newArrays = videoManager.removeVideo(index);
              setVideos(newArrays.videos);
              setVideoThumbnails(newArrays.thumbnails);
              setVideoUrls(newArrays.urls);
              setUploadStatuses(newArrays.statuses);
              
              // Clean up progress tracking
              setUploadProgress(prev => {
                const newProgress = {};
                Object.keys(prev).forEach(key => {
                  const keyIndex = parseInt(key);
                  if (keyIndex < index) {
                    newProgress[keyIndex] = prev[key];
                  } else if (keyIndex > index) {
                    newProgress[keyIndex - 1] = prev[key];
                  }
                });
                return newProgress;
              });
              
              console.log(`✅ Video at index ${index} removed from local state`);
              
            } catch (error) {
              console.error(`❌ Error deleting video:`, error);
              Alert.alert('Error', 'Failed to delete video. Please try again.');
            }
          },
        },
      ]
    );
  };

  /**
   * @function moveVideo
   * @description Move video position using video manager
   */
  const moveVideo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= videos.length) return;
    
    const newArrays = videoManager.moveVideo(fromIndex, toIndex);
    setVideos(newArrays.videos);
    setVideoThumbnails(newArrays.thumbnails);
    setVideoUrls(newArrays.urls);
    setUploadStatuses(newArrays.statuses);

    console.log(`🔄 Moved video from position ${fromIndex} to ${toIndex}`);
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
    const hasLocation = address.city && address.city.trim() !== '';
    const validVideos = videos.filter(video => video !== null);
    const validVideoUrls = videoUrls.filter(url => !!url);
    const allVideosUploaded = validVideos.length > 0 && validVideos.length === validVideoUrls.length;
    const noUploading = !uploadStatuses.some(status => status && status.uploading);
    return hasLocation && bio.trim() && allVideosUploaded && genres.length > 0 && profilePictureUri && noUploading;
  };

  /**
   * @function handleContinue
   * @description Builds the final user profile object and navigates to Feed screen.
   */
  const handleContinue = async () => {
    if (!isFormComplete()) {
      if (uploadStatuses.some(status => status && status.uploading)) {
        Alert.alert('Upload in Progress', 'Please wait for all videos to finish uploading.');
      } else if (!address.city || address.city.trim() === '') {
        Alert.alert('Location Required', 'Please enter your location.');
      } else if (videos.filter(v => v !== null).length === 0) {
        Alert.alert('Videos Required', 'Please upload at least one video.');
      }
      return;
    }
    
    setIsUploading(true);
    try {
      // Use the formatted address or create one from components
      const finalLocation = address.formattedAddress || 
        `${address.streetNumber ? address.streetNumber + ' ' : ''}${address.street ? address.street + ', ' : ''}${address.city}${address.region ? ', ' + address.region : ''}${address.country ? ', ' + address.country : ''}`;
  
      const completeUser = builder
        .setLocation(finalLocation)
        .setBio(bio)
        .setGenres(genres)
        .setProfilePicture(profilePictureUri)
        .setVideos(videoUrls.filter(url => !!url))
        .build();
      
      console.log('Updated user data with video URLs:', completeUser);
      
      const requestBody = {
        username: completeUser.username,
        fullName: completeUser.fullName,
        email: completeUser.email,
        password: completeUser.password,
        userType: completeUser.userType,
        bio: completeUser.bio,
        location: completeUser.location,
        genres: completeUser.genres,
        gender: completeUser.gender,
        instruments: completeUser.instruments || {},
        videoUrls: videoUrls.filter(url => !!url),
        addressDetails: address,
        profile_pic: completeUser.profilePicture || null,
      };

      console.log('Username being sent:', requestBody.username);
      
      if (completeUser.link) {
        requestBody.link = completeUser.link;
      }
  
      console.log('Request body being sent to Lambda:', requestBody);
  
      const res = await axios.post(BUILD_PROFILE_API_URL, requestBody);
      
      console.log('Lambda response:', res.data);
      
      const onboardingResult = await completeOnboarding();
      console.log('Onboarding completion result:', onboardingResult);
      
      if (!onboardingResult.success) {
        console.warn('Warning: Failed to mark onboarding as complete:', onboardingResult.error);
      }
      
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

  /**
   * Get current upload progress for display
   */
  const getOverallProgress = () => {
    const activeUploads = uploadStatuses.filter((status, index) => 
      status && status.uploading && videos[index] && videos[index] !== null
    );
    
    if (activeUploads.length === 0) return 0;
    
    let totalProgress = 0;
    let validProgressCount = 0;
    
    uploadStatuses.forEach((status, index) => {
      if (status && status.uploading && videos[index] && videos[index] !== null && uploadProgress[index] !== undefined) {
        totalProgress += uploadProgress[index];
        validProgressCount++;
      }
    });
    
    return validProgressCount > 0 ? Math.round(totalProgress / validProgressCount) : 0;
  };

  // Helper function to safely get video thumbnails that are not null
  const getValidVideoThumbnails = () => {
    return videoThumbnails
      .map((thumb, index) => ({ thumb, index, video: videos[index], status: uploadStatuses[index] }))
      .filter(item => item.thumb !== null && item.video !== null);
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
          contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        >          
          <TouchableOpacity 
            onPress={pickProfilePicture} 
            style={[styles.profilePictureContainer, {
              backgroundColor: isDark ? '#222' : '#eee',
            }]}
          >
            {profilePictureUri ? (
              <>
                <Image 
                  source={{ uri: profilePictureUri }} 
                  style={styles.profilePicture} 
                  resizeMode="cover"
                />
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              </>
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person-circle-outline" size={80} color={isDark ? '#ccc' : '#555'} />
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={20} color={isDark ? '#fff' : 'white'} />
                </View>
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
            onPress={pickVideos}
            disabled={uploadStatuses.some(status => status && status.uploading)}
          >
            <Ionicons name="cloud-upload-outline" size={24} color={isDark ? '#ccc' : '#555'} />
            <Text style={{ fontSize: 15, color: isDark ? '#ccc' : '#333', marginLeft: 8 }}>
              {uploadStatuses.some(status => status && status.uploading) 
                ? 'Uploading...' 
                : 'Choose videos (max 30s / 4MB each)'
              }
            </Text>
          </TouchableOpacity>

          {getValidVideoThumbnails().length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 }}>
              {getValidVideoThumbnails().map(({ thumb, index, video, status }) => (
                <View key={index} style={{ position: 'relative', alignItems: 'center' }}>
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
                      minWidth: 24,
                      alignItems: 'center',
                    }}
                  >
                    {status?.uploading ? (
                      <View style={{ alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={{ color: '#fff', fontSize: 8, marginTop: 2 }}>
                          {uploadProgress[index] || 0}%
                        </Text>
                      </View>
                    ) : status?.uploaded ? (
                      <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                    ) : status?.error ? (
                      <Ionicons name="close-circle" size={16} color="#f44336" />
                    ) : (
                      <Ionicons name="time-outline" size={16} color="#ff9800" />
                    )}
                  </View>

                  <Text style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 2 }}>
                    {video?.duration?.toFixed(1)}s • {(video?.size / (1024 * 1024))?.toFixed(1)}MB
                  </Text>

                  {status?.error && (
                    <Text style={{ fontSize: 8, color: '#f44336', textAlign: 'center', marginTop: 2, width: 70 }}>
                      {status.error}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => moveVideo(index, index - 1)}
                      disabled={index === 0 || uploadStatuses.some(status => status && status.uploading)}
                      style={{ marginHorizontal: 2, opacity: (index === 0 || uploadStatuses.some(status => status && status.uploading)) ? 0.3 : 1 }}
                    >
                      <Ionicons name="arrow-back-circle" size={22} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveVideo(index, index + 1)}
                      disabled={index === getValidVideoThumbnails().length - 1 || uploadStatuses.some(status => status && status.uploading)}
                      style={{ marginHorizontal: 2, opacity: (index === getValidVideoThumbnails().length - 1 || uploadStatuses.some(status => status && status.uploading)) ? 0.3 : 1 }}
                    >
                      <Ionicons name="arrow-forward-circle" size={22} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteVideo(index)}
                      disabled={uploadStatuses.some(status => status && status.uploading)}
                      style={{ marginHorizontal: 2, opacity: uploadStatuses.some(status => status && status.uploading) ? 0.3 : 1 }}
                    >
                      <Ionicons name="trash-bin" size={22} color="#888" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Upload Progress */}
          {uploadStatuses.some(status => status && status.uploading) && (
            <View style={styles.progressSection}>
              <Text style={[styles.progressText, { color: isDark ? '#fff' : '#000' }]}>
                Uploading {uploadStatuses.filter(status => status && status.uploading).length} of {videos.filter(v => v !== null).length} videos... {getOverallProgress()}%
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${getOverallProgress()}%` }]} 
                />
              </View>
            </View>
          )}

          {videoError !== '' && (
            <Text style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{videoError}</Text>
          )}

          {/* Location */}
          <AddressInput
            address={address}
            onAddressChange={handleAddressChange}
            autoDetectInitial={true}
          />

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
                      ? COLORS.ui?.accent || '#ff6ec4'
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
              colors={COLORS.static.primaryGradient}
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
    paddingBottom: 60,
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
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.static?.primaryGradient?.[0] || '#ff6ec4',
    borderRadius: 3,
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
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  profilePicturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#f0f0f0',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#555',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default ProfileSetupScreen;
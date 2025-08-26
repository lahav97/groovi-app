import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../components/common/Button';
import { COLORS } from '../../styles/theme';
import { getUploadService } from '../../services/uploadFileService';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import {
  ERROR_MESSAGES,
  createValidationError,
  handleError
} from '../../utils/errors';

const predefinedInstruments = {
  Strings: ['Guitar', 'Bass', 'Violin', 'Cello'],
  Percussion: ['Drums', 'Cajon', 'Bongos'],
  Keys: ['Piano', 'Synth'],
  Vocals: ['Lead Vocals', 'Backing Vocals'],
};

const predefinedGenres = ['Rock', 'Jazz', 'Pop', 'Funk', 'Classical', 'Hip Hop', 'Electronic', 'R&B'];

// Modern selectable chip component
const SelectableChip = ({ label, selected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      selected && styles.chipSelected
    ]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </Text>
    {selected && (
      <View style={styles.checkmarkContainer}>
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    )}
  </TouchableOpacity>
);

// Profile Card Component
const ProfileCard = ({ title, icon, children, style = {} }) => {
  const isDark = useColorScheme() === 'dark';
  const cardColor = isDark ? '#2c2c2e' : '#fff';
  const textColor = isDark ? '#fff' : '#000';

  return (
    <View style={[styles.card, { backgroundColor: cardColor }, style]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={24} color={COLORS.static.primaryGradient[0]} />
        <Text style={[styles.cardTitle, { color: textColor }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

const EditProfileScreen = ({ navigation }) => {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const uploadService = getUploadService(user);

  // Address fields that will be combined into a single address string
  const [city, setCity] = useState('Tel Aviv');
  const [country, setCountry] = useState('Israel');

  const [bio, setBio] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState(null);

  // Social links state
  const [socialLinks, setSocialLinks] = useState({
    instagram: '',
    youtube: '',
    spotify: '',
    soundcloud: '',
    website: ''
  });

  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [customInstrument, setCustomInstrument] = useState('');
  const [customGenre, setCustomGenre] = useState('');

  const [videos, setVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [videoKeys, setVideoKeys] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({});

  // Save loading state
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Initialize with example data
    setBio('Percussionist. Music lover.');
    setSelectedInstruments(['Drums']);
    setSelectedGenres(['Rock']);
    setSocialLinks({
      instagram: '@musician',
      youtube: '',
      spotify: '',
      soundcloud: '',
      website: ''
    });
  }, []);

  const toggleSelection = (item, list, setList) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const addCustomItem = (value, list, setList, setInput) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput('');
    }
  };

  /**
   * @function updateSocialLink
   * @description Update a specific social link
   */
  const updateSocialLink = (platform, value) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  /**
   * @function pickProfilePicture
   * @description Pick and upload profile picture using upload service
   */
  const pickProfilePicture = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', ERROR_MESSAGES.PERMISSION.MEDIA_DENIED);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const selectedAsset = result.assets[0];
      
      try {
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
          Alert.alert('Upload Error', handleError(uploadResult.error, 'EditProfileScreen/pickProfilePicture'));
          setProfilePictureUri(selectedAsset.uri);
        }
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        Alert.alert('Error', handleError(error, 'EditProfileScreen/pickProfilePicture'));
        setProfilePictureUri(selectedAsset.uri);
      }
    }
  };

  /**
   * @function processSelectedVideo
   * @description Process a single selected video using upload service
   */
  const processSelectedVideo = async (selectedAsset, index) => {
    try {
      // Check for duplicates using the upload service
      const duplicateCheck = await uploadService.checkVideoDuplicate(selectedAsset, videoKeys);
      
      if (duplicateCheck.error) {
        Alert.alert('Error', handleError(duplicateCheck.error, 'EditProfileScreen/processSelectedVideo'));
        return false;
      }

      if (duplicateCheck.isDuplicate) {
        Alert.alert('Duplicate Video', `Video "${selectedAsset.fileName || 'Unknown'}" has already been added.`);
        return false;
      }

      // Validate video using the service (now with 45s / 20MB limits)
      const validation = await uploadService.validateVideoFile(selectedAsset);
      
      if (!validation.success) {
        Alert.alert('Invalid Video', `${selectedAsset.fileName || 'Video'}: ${handleError(validation.error, 'EditProfileScreen/processSelectedVideo')}`);
        return false;
      }

      // Create temporary video object
      const videoData = {
        id: selectedAsset.assetId || Date.now().toString() + Math.random(),
        uri: selectedAsset.uri,
        fileName: selectedAsset.fileName || `video_${Date.now()}.mp4`,
        mimeType: selectedAsset.mimeType || 'video/mp4',
        duration: validation.fileInfo.durationSec,
        size: validation.fileInfo.sizeBytes,
        thumbnail: selectedAsset.uri + "#t=0.1", // Temporary thumbnail
      };

      // Add to state
      const currentIndex = videos.length + index;
      setVideos(prev => [...prev, videoData]);
      setVideoThumbnails(prev => [...prev, videoData.thumbnail]);
      setUploadStatuses(prev => [...prev, { uploading: true, uploaded: false, error: null }]);
      setVideoKeys(prev => new Set(prev).add(duplicateCheck.videoKey));

      // Start upload immediately
      uploadSingleVideo(videoData, currentIndex);
      
      return true;
    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', handleError(error, 'EditProfileScreen/processSelectedVideo'));
      return false;
    }
  };

  /**
   * @function uploadSingleVideo
   * @description Upload a single video using the upload service
   */
  const uploadSingleVideo = async (videoData, index) => {
    try {
      // Upload using the service with progress tracking
      const uploadResult = await uploadService.uploadVideo(
        {
          uri: videoData.uri,
          fileName: videoData.fileName,
          mimeType: videoData.mimeType,
          duration: videoData.duration,
          assetId: videoData.id
        },
        index,
        (progress) => {
          console.log(`Video ${index + 1} upload progress:`, progress);
          setUploadProgress(prev => ({
            ...prev,
            [index]: progress.progress || 0
          }));
        }
      );

      if (uploadResult.success) {
        // Update video with upload results
        setVideos(prev => {
          const newVideos = [...prev];
          if (newVideos[index]) {
            newVideos[index] = uploadResult.videoObject;
          }
          return newVideos;
        });

        // Update thumbnail if we got a better one
        if (uploadResult.thumbnailUri !== videoData.thumbnail) {
          setVideoThumbnails(prev => {
            const newThumbs = [...prev];
            if (newThumbs[index]) {
              newThumbs[index] = uploadResult.thumbnailUri;
            }
            return newThumbs;
          });
        }

        // Add URL to videoUrls array
        setVideoUrls(prev => {
          const newUrls = [...prev];
          newUrls[index] = uploadResult.videoUrl;
          return newUrls;
        });

        // Update status to uploaded
        setUploadStatuses(prev => {
          const newStatuses = [...prev];
          if (newStatuses[index]) {
            newStatuses[index] = { uploading: false, uploaded: true, error: null };
          }
          return newStatuses;
        });
      } else {
        // Update status to error
        setUploadStatuses(prev => {
          const newStatuses = [...prev];
          if (newStatuses[index]) {
            newStatuses[index] = { uploading: false, uploaded: false, error: uploadResult.error };
          }
          return newStatuses;
        });
      }
    } catch (error) {
      console.error(`Failed to upload video ${index + 1}:`, error);
      
      // Update status to error
      setUploadStatuses(prev => {
        const newStatuses = [...prev];
        if (newStatuses[index]) {
          newStatuses[index] = { uploading: false, uploaded: false, error: error.message };
        }
        return newStatuses;
      });
    }
  };

  /**
   * @function pickVideos
   * @description Pick multiple videos from device library
   */
  const pickVideos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', ERROR_MESSAGES.PERMISSION.MEDIA_DENIED);
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

      // Process each selected video
      let successCount = 0;
      for (let i = 0; i < result.assets.length; i++) {
        const success = await processSelectedVideo(result.assets[i], i);
        if (success) successCount++;
      }

      if (successCount > 0) {
        console.log(`Successfully added ${successCount} videos for upload`);
      }
    } catch (error) {
      console.error('Error picking videos:', error);
      Alert.alert('Error', handleError(error, 'EditProfileScreen/pickVideos'));
    }
  };

  /**
   * @function deleteVideo
   * @description Enhanced with service integration
   */
  const deleteVideo = async (index) => {
    const videoToDelete = videos[index];
    if (!videoToDelete) {
      Alert.alert('Error', handleError(createValidationError('REQUIRED_FIELD', 'videoToDelete'), 'EditProfileScreen/deleteVideo'));
      return;
    }

    try {
      // Remove video key from set
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

      // Optionally delete from server using the service
      if (videoToDelete.fileName && uploadStatuses[index]?.uploaded) {
        await uploadService.deleteFile(videoToDelete.fileName);
      }

      // Remove from local state
      setVideos(prev => prev.filter((_, i) => i !== index));
      setVideoThumbnails(prev => prev.filter((_, i) => i !== index));
      setVideoUrls(prev => prev.filter((_, i) => i !== index));
      setUploadStatuses(prev => prev.filter((_, i) => i !== index));
      
      // Clean up progress tracking
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[index];
        return newProgress;
      });
      
      console.log(`Video at index ${index} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting video:`, error);
      Alert.alert('Error', handleError(error, 'EditProfileScreen/deleteVideo') || 'Failed to delete video completely, but removed from local list.');
      
      // Still remove from local state even if server deletion fails
      setVideos(prev => prev.filter((_, i) => i !== index));
      setVideoThumbnails(prev => prev.filter((_, i) => i !== index));
      setVideoUrls(prev => prev.filter((_, i) => i !== index));
      setUploadStatuses(prev => prev.filter((_, i) => i !== index));
    }
  };

  const moveVideo = (from, to) => {
    if (to < 0 || to >= videos.length) return;
    const move = (arr) => {
      const updated = [...arr];
      const [item] = updated.splice(from, 1);
      updated.splice(to, 0, item);
      return updated;
    };
    setVideos(move);
    setVideoThumbnails(move);
    setVideoUrls(move);
    setUploadStatuses(move);
  };

  const isFormValid = () => {
    return city.trim() || country.trim() || bio || profilePictureUri || videos.length || selectedInstruments.length || selectedGenres.length || Object.values(socialLinks).some(link => link.trim());
  };

  /**
   * @function handleSave
   * @description Save profile data to Lambda function with proper field mapping
   */
  const handleSave = async () => {
    if (!isFormValid()) {
      Alert.alert('No changes', 'Please fill out at least one field before saving.');
      return;
    }

    if (uploadStatuses.some(status => status.uploading)) {
      Alert.alert('Upload in Progress', 'Please wait for all videos to finish uploading before saving.');
      return;
    }

    setIsSaving(true);

    try {
      // Prepare data with correct field names for Lambda
      const updateData = {};

      // Address (combine city and country)
      if (city.trim() || country.trim()) {
        const addressParts = [city.trim(), country.trim()].filter(Boolean);
        updateData.address = addressParts.join(', ');
      }

      // Profile picture (use snake_case as expected by Lambda)
      if (profilePictureUri) {
        updateData.profile_picture = profilePictureUri;
      }

      // Bio
      if (bio.trim()) {
        updateData.bio = bio.trim();
      }

      // Social links (filter out empty links)
      const validSocialLinks = Object.entries(socialLinks)
        .filter(([_, value]) => value.trim())
        .reduce((acc, [key, value]) => {
          acc[key] = value.trim();
          return acc;
        }, {});
      
      if (Object.keys(validSocialLinks).length > 0) {
        updateData.social_links = validSocialLinks;
      }

      // Instruments
      if (selectedInstruments.length > 0) {
        updateData.instruments = selectedInstruments;
      }

      // Genres
      if (selectedGenres.length > 0) {
        updateData.genres = selectedGenres;
      }

      // Videos (only include successfully uploaded videos)
      const uploadedVideoUrls = videoUrls.filter((url, index) => 
        url && uploadStatuses[index]?.uploaded
      );
      if (uploadedVideoUrls.length > 0) {
        updateData.videos = uploadedVideoUrls;
      }

      console.log('Sending update data to Lambda:', updateData);

      // Check if there's actually data to update
      if (Object.keys(updateData).length === 0) {
        Alert.alert('No changes', 'No valid changes detected to save.');
        setIsSaving(false);
        return;
      }

      // Make API call to Lambda function
      const response = await axios.put(
        'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/edit',
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            // Add any authentication headers here if needed
            // 'Authorization': `Bearer ${user?.token}` // example
          },
          timeout: 30000, // 30 second timeout
        }
      );

      console.log('Lambda response:', response.data);

      if (response.status === 200) {
        Alert.alert(
          'Success', 
          'Your profile has been updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        throw new Error(response.data?.message || 'Unexpected response from server');
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', handleError(error, 'EditProfileScreen/handleSave'));
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Get overall upload progress
   */
  const getOverallProgress = () => {
    const uploadingVideos = uploadStatuses.filter(status => status.uploading);
    if (uploadingVideos.length === 0) return 0;
    
    const totalProgress = Object.values(uploadProgress).reduce((sum, progress) => sum + progress, 0);
    return Math.round(totalProgress / uploadingVideos.length);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f5f5f7' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: isDark ? '#fff' : '#000' }]}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Address Card */}
        <ProfileCard title="Address" icon="location-outline">
          <View style={styles.rowContainer}>
            <TextInput
              style={[styles.input, styles.halfInput, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              placeholder="City"
              placeholderTextColor="#9E9E9E"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={[styles.input, styles.halfInput, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              placeholder="Country"
              placeholderTextColor="#9E9E9E"
              value={country}
              onChangeText={setCountry}
            />
          </View>
          <Text style={[styles.helpText, { color: isDark ? '#aaa' : '#666' }]}>
            Will be saved as: {city.trim() && country.trim() ? `${city}, ${country}` : city.trim() || country.trim() || 'Address not set'}
          </Text>
        </ProfileCard>

        {/* Profile Picture Card */}
        <ProfileCard title="Profile Picture" icon="person-outline">
          <TouchableOpacity onPress={pickProfilePicture} style={styles.profilePictureContainer}>
            {profilePictureUri ? (
              <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person-circle-outline" size={60} color={isDark ? '#777' : '#aaa'} />
                <Text style={[styles.placeholderText, { color: isDark ? '#aaa' : '#666' }]}>
                  Tap to add photo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ProfileCard>

        {/* Bio Card */}
        <ProfileCard title="Bio" icon="document-text-outline">
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#9E9E9E"
            multiline
            style={[styles.bioInput, { 
              backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
              color: isDark ? '#fff' : '#000'
            }]}
          />
        </ProfileCard>

        {/* Social Links Card */}
        <ProfileCard title="Social Links" icon="link-outline">
          {Object.entries(socialLinks).map(([platform, value]) => (
            <View key={platform} style={styles.socialLinkRow}>
              <Ionicons 
                name={platform === 'website' ? 'globe-outline' : 'logo-' + platform} 
                size={20} 
                color={COLORS.static.primaryGradient[0]} 
                style={styles.socialIcon}
              />
              <TextInput
                style={[styles.input, styles.socialInput, { 
                  backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                  color: isDark ? '#fff' : '#000'
                }]}
                placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} ${platform === 'website' ? 'URL' : 'username'}`}
                placeholderTextColor="#9E9E9E"
                value={value}
                onChangeText={(text) => updateSocialLink(platform, text)}
                autoCapitalize="none"
                keyboardType={platform === 'website' ? 'url' : 'default'}
              />
            </View>
          ))}
        </ProfileCard>

        {/* Instruments Card */}
        <ProfileCard title="Instruments" icon="musical-notes-outline">
          {Object.entries(predefinedInstruments).map(([category, instruments]) => (
            <View key={category}>
              <Text style={[styles.categoryLabel, { color: isDark ? '#fff' : '#000' }]}>{category}</Text>
              <View style={styles.chipGrid}>
                {instruments.map(instrument => (
                  <SelectableChip
                    key={instrument}
                    label={instrument}
                    selected={selectedInstruments.includes(instrument)}
                    onSelect={() => toggleSelection(instrument, selectedInstruments, setSelectedInstruments)}
                  />
                ))}
              </View>
            </View>
          ))}
          
          <View style={styles.customRow}>
            <TextInput
              value={customInstrument}
              onChangeText={setCustomInstrument}
              placeholder="Add custom instrument..."
              placeholderTextColor="#9E9E9E"
              style={[styles.input, styles.flex1, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              onSubmitEditing={() => {
                addCustomItem(customInstrument, selectedInstruments, setSelectedInstruments, setCustomInstrument);
              }}
            />
            <TouchableOpacity
              onPress={() => addCustomItem(customInstrument, selectedInstruments, setSelectedInstruments, setCustomInstrument)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedInstruments.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedTitle, { color: isDark ? '#fff' : '#000' }]}>Selected:</Text>
              <View style={styles.selectedChips}>
                {selectedInstruments.map(instrument => (
                  <View key={instrument} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{instrument}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedInstruments(selectedInstruments.filter(i => i !== instrument))}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Ionicons name="close-circle" size={16} color={COLORS.static.primaryGradient[0]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ProfileCard>

        {/* Genres Card */}
        <ProfileCard title="Genres" icon="disc-outline">
          <View style={styles.chipGrid}>
            {predefinedGenres.map(genre => (
              <SelectableChip
                key={genre}
                label={genre}
                selected={selectedGenres.includes(genre)}
                onSelect={() => toggleSelection(genre, selectedGenres, setSelectedGenres)}
              />
            ))}
          </View>
          
          <View style={styles.customRow}>
            <TextInput
              value={customGenre}
              onChangeText={setCustomGenre}
              placeholder="Add custom genre..."
              placeholderTextColor="#9E9E9E"
              style={[styles.input, styles.flex1, { 
                backgroundColor: isDark ? '#3c3c3e' : '#F5F5F5',
                color: isDark ? '#fff' : '#000'
              }]}
              onSubmitEditing={() => {
                addCustomItem(customGenre, selectedGenres, setSelectedGenres, setCustomGenre);
              }}
            />
            <TouchableOpacity
              onPress={() => addCustomItem(customGenre, selectedGenres, setSelectedGenres, setCustomGenre)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedGenres.length > 0 && (
            <View style={styles.selectedContainer}>
              <Text style={[styles.selectedTitle, { color: isDark ? '#fff' : '#000' }]}>Selected:</Text>
              <View style={styles.selectedChips}>
                {selectedGenres.map(genre => (
                  <View key={genre} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{genre}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedGenres(selectedGenres.filter(g => g !== genre))}
                      hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Ionicons name="close-circle" size={16} color={COLORS.static.primaryGradient[0]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ProfileCard>

        {/* Videos Card */}
        <ProfileCard title="Videos" icon="videocam-outline">
          <TouchableOpacity 
            onPress={pickVideos} 
            style={styles.uploadBtn}
            disabled={uploadStatuses.some(status => status.uploading)}
          >
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.static.primaryGradient[0]} />
            <Text style={[styles.uploadText, { color: isDark ? '#fff' : '#000' }]}>
              {uploadStatuses.some(status => status.uploading) 
                ? 'Uploading...' 
                : 'Upload Videos (max 45s / 20MB each)'
              }
            </Text>
          </TouchableOpacity>

          {/* Video Grid */}
          {videoThumbnails.length > 0 && (
            <View style={styles.videoGrid}>
              {videoThumbnails.map((thumb, index) => (
                <View key={index} style={styles.videoCard}>
                  <Image
                    source={{ uri: thumb }}
                    style={styles.videoThumbnail}
                  />
                  
                  {/* Status Indicator */}
                  <View style={styles.statusIndicator}>
                    {uploadStatuses[index]?.uploading ? (
                      <View style={styles.progressIndicator}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.progressText}>
                          {uploadProgress[index] || 0}%
                        </Text>
                      </View>
                    ) : uploadStatuses[index]?.uploaded ? (
                      <Ionicons name="checkmark-circle" size={20} color="#4caf50" />
                    ) : uploadStatuses[index]?.error ? (
                      <Ionicons name="close-circle" size={20} color="#f44336" />
                    ) : (
                      <Ionicons name="time-outline" size={20} color="#ff9800" />
                    )}
                  </View>

                  {/* Video Info */}
                  <Text style={styles.videoInfo}>
                    {videos[index]?.duration?.toFixed(1)}s • {(videos[index]?.size / (1024 * 1024))?.toFixed(1)}MB
                  </Text>

                  {/* Error Message */}
                  {uploadStatuses[index]?.error && (
                    <Text style={styles.errorText} numberOfLines={2}>
                      {uploadStatuses[index].error}
                    </Text>
                  )}

                  {/* Controls */}
                  <View style={styles.videoControls}>
                    <TouchableOpacity
                      onPress={() => moveVideo(index, index - 1)}
                      disabled={index === 0 || uploadStatuses.some(status => status.uploading)}
                      style={[styles.controlButton, { opacity: (index === 0 || uploadStatuses.some(status => status.uploading)) ? 0.3 : 1 }]}
                    >
                      <Ionicons name="arrow-back" size={16} color="#666" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => deleteVideo(index)}
                      disabled={uploadStatuses.some(status => status.uploading)}
                      style={[styles.controlButton, { opacity: uploadStatuses.some(status => status.uploading) ? 0.3 : 1 }]}
                    >
                      <Ionicons name="trash" size={16} color="#f44336" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => moveVideo(index, index + 1)}
                      disabled={index === videos.length - 1 || uploadStatuses.some(status => status.uploading)}
                      style={[styles.controlButton, { opacity: (index === videos.length - 1 || uploadStatuses.some(status => status.uploading)) ? 0.3 : 1 }]}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Upload Progress */}
          {uploadStatuses.some(status => status.uploading) && (
            <View style={styles.progressSection}>
              <Text style={[styles.progressSectionText, { color: isDark ? '#fff' : '#000' }]}>
                Uploading {uploadStatuses.filter(status => status.uploading).length} of {videos.length} videos... {getOverallProgress()}%
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${getOverallProgress()}%` }]} 
                />
              </View>
            </View>
          )}
        </ProfileCard>

        {/* Save Button - Part of ScrollView Content */}
        <TouchableOpacity 
          onPress={handleSave} 
          style={[
            styles.saveButton, 
            (uploadStatuses.some(status => status.uploading) || isSaving) && styles.saveButtonDisabled
          ]} 
          activeOpacity={0.8}
          disabled={uploadStatuses.some(status => status.uploading) || isSaving}
        >
          <LinearGradient 
            colors={
              uploadStatuses.some(status => status.uploading) || isSaving 
                ? ['#888', '#888'] 
                : COLORS.static.primaryGradient
            } 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            style={styles.gradient}
          >
            {uploadStatuses.some(status => status.uploading) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveText}>Uploading Videos...</Text>
              </View>
            ) : isSaving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveText}>Saving Profile...</Text>
              </View>
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scroll: { 
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
  },
  helpText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  input: { 
    borderRadius: 12, 
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  bioInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    height: 100,
    textAlignVertical: 'top',
  },
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginVertical: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  profilePicture: { 
    width: '100%', 
    height: '100%' 
  },
  profilePicturePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  socialLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  socialIcon: {
    marginRight: 12,
    width: 24,
  },
  socialInput: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginBottom: 12,
  },
  chip: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    marginRight: 8, 
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent'
  },
  chipSelected: { 
    backgroundColor: '#E1C4FF',
    borderColor: COLORS.static.primaryGradient[0],
  },
  chipText: { 
    color: '#555', 
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: { 
    color: COLORS.static.primaryGradient[0], 
    fontWeight: '600' 
  },
  checkmarkContainer: {
    backgroundColor: COLORS.static.primaryGradient[0],
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  flex1: { flex: 1 },
  addBtn: {
    backgroundColor: COLORS.static.primaryGradient[0],
    padding: 12,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  selectedContainer: {
    marginTop: 16
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1C4FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.static.primaryGradient[0],
  },
  selectedChipText: {
    fontSize: 14,
    color: COLORS.static.primaryGradient[0],
    marginRight: 6,
    fontWeight: '500'
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.static.primaryGradient[0],
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  videoCard: {
    width: 100,
    alignItems: 'center',
  },
  videoThumbnail: {
    width: 80,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  statusIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minWidth: 24,
    alignItems: 'center',
  },
  progressIndicator: {
    alignItems: 'center',
  },
  progressText: {
    color: '#fff',
    fontSize: 8,
    marginTop: 2,
  },
  videoInfo: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 8,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 2,
    width: 80,
  },
  videoControls: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  controlButton: {
    padding: 4,
  },
  progressSection: {
    marginTop: 16,
  },
  progressSectionText: {
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
    backgroundColor: COLORS.static.primaryGradient[0],
    borderRadius: 3,
  },
  // Save button as part of content
  saveButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  gradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 30,
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});

export default EditProfileScreen;
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useColorScheme,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../../styles/theme';
import { getUploadService } from '../../services/uploadFileService';
import { useAuth } from '../../context/AuthContext'; // Assuming you have auth context

const VideoUploadScreen = () => {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth(); // Get current user
  const uploadService = getUploadService(user);
  
  const [videos, setVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState(null);
  const [videoKeys, setVideoKeys] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({}); // Track progress per video

  /**
   * Pick multiple videos from device library
   */
  const pickVideos = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to media library.');
        return;
      }

      // Launch image picker for videos
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      // Process each selected video
      for (const selectedAsset of result.assets) {
        await processSelectedVideo(selectedAsset);
      }

    } catch (error) {
      console.error('Error picking videos:', error);
      Alert.alert('Error', 'Failed to select videos. Please try again.');
    }
  };

  /**
   * Process a single selected video using the upload service
   */
  const processSelectedVideo = async (selectedAsset) => {
    try {
      // Check for duplicates using the upload service
      const duplicateCheck = await uploadService.checkVideoDuplicate(selectedAsset, videoKeys);
      
      if (duplicateCheck.error) {
        Alert.alert('Error', duplicateCheck.error);
        return;
      }

      if (duplicateCheck.isDuplicate) {
        Alert.alert('Duplicate Video', 'You have already added this video.');
        return;
      }

      // Validate video using the service
      const validation = await uploadService.validateVideoFile(selectedAsset);
      
      if (!validation.success) {
        Alert.alert('Invalid Video', validation.error);
        return;
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
      setVideos(prev => [...prev, videoData]);
      setVideoThumbnails(prev => [...prev, videoData.thumbnail]);
      setUploadStatuses(prev => [...prev, { uploading: false, uploaded: false, error: null }]);
      setVideoKeys(prev => new Set(prev).add(duplicateCheck.videoKey));

    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process video.');
    }
  };

  /**
   * Upload a single video using the upload service
   */
  const uploadSingleVideo = async (videoData, index) => {
    try {
      setCurrentUploadingIndex(index);
      
      // Update status to uploading
      setUploadStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[index] = { uploading: true, uploaded: false, error: null };
        return newStatuses;
      });

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
          newVideos[index] = uploadResult.videoObject;
          return newVideos;
        });

        // Update thumbnail if we got a better one
        if (uploadResult.thumbnailUri !== videoData.thumbnail) {
          setVideoThumbnails(prev => {
            const newThumbs = [...prev];
            newThumbs[index] = uploadResult.thumbnailUri;
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
          newStatuses[index] = { uploading: false, uploaded: true, error: null };
          return newStatuses;
        });

        return { success: true, videoUrl: uploadResult.videoUrl };
      } else {
        // Update status to error
        setUploadStatuses(prev => {
          const newStatuses = [...prev];
          newStatuses[index] = { uploading: false, uploaded: false, error: uploadResult.error };
          return newStatuses;
        });

        return { success: false, error: uploadResult.error };
      }

    } catch (error) {
      console.error(`Failed to upload video ${index + 1}:`, error);
      
      // Update status to error
      setUploadStatuses(prev => {
        const newStatuses = [...prev];
        newStatuses[index] = { uploading: false, uploaded: false, error: error.message };
        return newStatuses;
      });

      return { success: false, error: error.message };
    }
  };

  /**
   * Upload all selected videos
   */
  const handleUploadAll = async () => {
    if (videos.length === 0) {
      Alert.alert('No videos selected', 'Please select at least one video.');
      return;
    }

    setIsUploading(true);
    
    try {
      const uploadedUrls = [];
      let successCount = 0;

      // Upload videos one by one
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        
        const result = await uploadSingleVideo(video, i);
        
        if (result.success) {
          uploadedUrls.push(result.videoUrl);
          successCount++;
        } else {
          uploadedUrls.push(null); // Placeholder for failed upload
        }
      }

      Alert.alert(
        'Upload Complete!', 
        `${successCount} of ${videos.length} videos uploaded successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (successCount > 0) {
                navigation.navigate('Feed');
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Upload process failed:', error);
      Alert.alert('Upload Failed', 'Failed to upload videos. Please try again.');
    } finally {
      setIsUploading(false);
      setCurrentUploadingIndex(null);
      setUploadProgress({});
    }
  };

  /**
   * Remove a video from the list
   */
  const removeVideo = (index) => {
    const videoToRemove = videos[index];
    if (videoToRemove) {
      // Remove from videoKeys set using the service method
      const videoKey = uploadService.createVideoKey(
        videoToRemove.fileName || '',
        videoToRemove.size,
        videoToRemove.duration
      );
      setVideoKeys(prev => {
        const newKeys = new Set(prev);
        newKeys.delete(videoKey);
        return newKeys;
      });
    }

    setVideos(prev => prev.filter((_, i) => i !== index));
    setVideoThumbnails(prev => prev.filter((_, i) => i !== index));
    setUploadStatuses(prev => prev.filter((_, i) => i !== index));
    setVideoUrls(prev => prev.filter((_, i) => i !== index));
    
    // Clean up progress tracking
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[index];
      return newProgress;
    });
  };

  /**
   * Move video position
   */
  const moveVideo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= videos.length) return;
    
    const moveArray = (arr) => {
      const newArr = [...arr];
      const [movedItem] = newArr.splice(fromIndex, 1);
      newArr.splice(toIndex, 0, movedItem);
      return newArr;
    };

    setVideos(moveArray);
    setVideoThumbnails(moveArray);
    setUploadStatuses(moveArray);
    setVideoUrls(moveArray);
  };

  /**
   * Get current upload progress for display
   */
  const getCurrentUploadProgress = () => {
    if (currentUploadingIndex !== null && uploadProgress[currentUploadingIndex]) {
      return uploadProgress[currentUploadingIndex];
    }
    return 0;
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f5f5f7' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Upload Videos</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Video Selection Button */}
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={pickVideos}
          activeOpacity={0.7}
          disabled={isUploading}
        >
          <LinearGradient
            colors={isUploading ? ['#888', '#888'] : ['#d981c3', '#6233b4']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.uploadButtonGradient}
          >
            <Ionicons name="cloud-upload-outline" size={32} color="#fff" />
            <Text style={styles.uploadButtonText}>
              {isUploading ? 'Uploading...' : 'Select Videos'}
            </Text>
            <Text style={styles.uploadButtonSubtext}>
              Max 45 seconds, 20MB each
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Selected Videos Grid */}
        {videos.length > 0 && (
          <View style={styles.videosContainer}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Selected Videos ({videos.length})
            </Text>
            
            <View style={styles.videosGrid}>
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
                    {videos[index]?.duration.toFixed(1)}s • {(videos[index]?.size / (1024 * 1024)).toFixed(1)}MB
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
                      disabled={index === 0 || isUploading}
                      style={[styles.controlButton, { opacity: (index === 0 || isUploading) ? 0.3 : 1 }]}
                    >
                      <Ionicons name="arrow-back" size={16} color="#666" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => removeVideo(index)}
                      disabled={isUploading}
                      style={[styles.controlButton, { opacity: isUploading ? 0.3 : 1 }]}
                    >
                      <Ionicons name="trash" size={16} color="#f44336" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => moveVideo(index, index + 1)}
                      disabled={index === videos.length - 1 || isUploading}
                      style={[styles.controlButton, { opacity: (index === videos.length - 1 || isUploading) ? 0.3 : 1 }]}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <View style={styles.progressSection}>
            <Text style={[styles.progressText, { color: isDark ? '#fff' : '#000' }]}>
              Uploading video {(currentUploadingIndex || 0) + 1} of {videos.length}... {getCurrentUploadProgress()}%
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${getCurrentUploadProgress()}%` }]} 
              />
            </View>
          </View>
        )}

        {/* Upload Summary */}
        {videos.length > 0 && !isUploading && (
          <View style={styles.summarySection}>
            <Text style={[styles.summaryText, { color: isDark ? '#fff' : '#000' }]}>
              Ready to upload: {videos.filter((_, i) => !uploadStatuses[i]?.uploaded).length} videos
            </Text>
            {uploadStatuses.some(status => status.uploaded) && (
              <Text style={[styles.summaryText, { color: '#4caf50' }]}>
                Uploaded: {uploadStatuses.filter(status => status.uploaded).length} videos
              </Text>
            )}
            {uploadStatuses.some(status => status.error) && (
              <Text style={[styles.summaryText, { color: '#f44336' }]}>
                Failed: {uploadStatuses.filter(status => status.error).length} videos
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Upload Button */}
      {videos.length > 0 && (
        <View style={styles.uploadButtonContainer}>
          <TouchableOpacity 
            style={[styles.uploadAllButton, isUploading && styles.uploadButtonDisabled]}
            onPress={handleUploadAll}
            disabled={isUploading}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isUploading ? ['#888', '#888'] : ['#d981c3', '#6233b4']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.uploadAllGradient}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="cloud-upload" size={24} color="#fff" />
              )}
              <Text style={styles.uploadAllText}>
                {isUploading ? 'Uploading...' : `Upload ${videos.filter((_, i) => !uploadStatuses[i]?.uploaded).length} Video${videos.filter((_, i) => !uploadStatuses[i]?.uploaded).length !== 1 ? 's' : ''}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  uploadButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 20,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  uploadButtonSubtext: {
    fontSize: 14,
    marginLeft: 8,
    color: '#fff',
    opacity: 0.9,
  },
  videosContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  videosGrid: {
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
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#d981c3',
    borderRadius: 3,
  },
  summarySection: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  uploadButtonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  uploadAllButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  uploadAllText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});

export default VideoUploadScreen;
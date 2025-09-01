import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  useColorScheme,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getUploadService } from '../../services/uploadFileService';
import { 
  processBatchVideos, 
  createVideoManager, 
  deleteVideoFromS3 
} from '../../services/videoService';
import { useAuth } from '../../context/AuthContext';
import {
  ERROR_MESSAGES,
  createValidationError,
  handleError
} from '../../utils/errors';
import { createLogger } from '../../utils/Logger';

const logger = createLogger('VideoUploadScreen');

const VideoUploadScreen = () => {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuth();
  const uploadService = getUploadService(user);
  
  const [videos, setVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState([]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [uploadStatuses, setUploadStatuses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingIndex, setCurrentUploadingIndex] = useState(null);
  const [videoKeys, setVideoKeys] = useState(new Set());
  const [uploadProgress, setUploadProgress] = useState({});

  // Create video manager instance
  const videoManager = createVideoManager(videos, videoThumbnails, videoUrls, uploadStatuses);

  /**
   * Pick multiple videos from device library with validation
   */
  const pickVideos = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', ERROR_MESSAGES.PERMISSION.MEDIA_DENIED);
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

      logger.info(`📱 Processing ${result.assets.length} selected videos`);

      // Process videos using the video service with upload screen limits
      const processingOptions = {
        maxSizeMB: 20,
        maxDurationSec: 45
      };

      const batchResult = await processBatchVideos(
        result.assets, 
        videoKeys, 
        processingOptions,
        (progress) => {
          logger.debug(`Processing video ${progress.current}/${progress.total}`);
        }
      );

      if (batchResult.success) {
        // Update state with processed videos
        batchResult.processedVideos.forEach((videoData) => {
          const newArrays = videoManager.addVideo(
            videoData,
            videoData.thumbnail,
            null,
            { uploading: false, uploaded: false, error: null }
          );
          
          setVideos(newArrays.videos);
          setVideoThumbnails(newArrays.thumbnails);
          setVideoUrls(newArrays.urls);
          setUploadStatuses(newArrays.statuses);
        });

        // Update video keys
        setVideoKeys(batchResult.videoKeys);

        // Show errors if any
        if (batchResult.errors.length > 0) {
          const errorMessages = batchResult.errors.map(e => handleError(e, 'VideoUploadScreen/pickVideos')).join('\n');
          Alert.alert('Some videos could not be processed', errorMessages);
        }

        logger.info(`✅ Processed ${batchResult.processedVideos.length} videos successfully`);
      } else {
        Alert.alert('Error', handleError(batchResult.error, 'VideoUploadScreen/pickVideos') || 'Failed to process videos');
      }

    } catch (error) {
      logger.error('Error picking videos', { error: error.message });
      Alert.alert('Error', handleError(error, 'VideoUploadScreen/pickVideos'));
    }
  };

  /**
   * Upload all selected videos using the upload service
   */
  const handleUploadAll = async () => {
    if (videos.length === 0) {
      Alert.alert('No videos selected', 'Please select at least one video.');
      return;
    }

    setIsUploading(true);
    
    try {
      logger.info(`🚀 Starting upload of ${videos.length} videos`);

      // Filter out already uploaded videos
      const videosToUpload = videos.filter((_, index) => !uploadStatuses[index]?.uploaded);
      
      if (videosToUpload.length === 0) {
        Alert.alert('All videos uploaded', 'All selected videos have already been uploaded.');
        setIsUploading(false);
        return;
      }

      const uploadResult = await uploadService.uploadMultipleVideos(
        videosToUpload,
        // Progress callback for overall batch progress
        (progressData) => {
          setCurrentUploadingIndex(progressData.videoIndex);
          setUploadProgress(prev => ({
            ...prev,
            [progressData.videoIndex]: progressData.currentProgress
          }));
          
          logger.debug(`Upload progress: Video ${progressData.videoIndex + 1}/${progressData.totalVideos} - ${progressData.currentProgress}% (${progressData.stage})`);
        },
        // Single video complete callback
        (index, result) => {
          const actualIndex = videos.findIndex(v => v === videosToUpload[index]);
          
          if (result.success) {
            // Update arrays with successful upload
            const newArrays = videoManager.updateVideo(actualIndex, {
              videoData: result.videoObject,
              url: result.videoUrl,
              status: { uploading: false, uploaded: true, error: null }
            });
            
            setVideos(newArrays.videos);
            setVideoUrls(newArrays.urls);
            setUploadStatuses(newArrays.statuses);
            
            logger.info(`✅ Video ${index + 1} uploaded successfully: ${result.videoUrl}`);
          } else {
            // Update status with error
            const newArrays = videoManager.updateVideo(actualIndex, {
              status: { uploading: false, uploaded: false, error: handleError(result.error, 'VideoUploadScreen/handleUploadAll') }
            });
            
            setUploadStatuses(newArrays.statuses);
            logger.error(`❌ Video ${index + 1} upload failed`, { error: result.error });
          }
        },
        // Upload options
        {
          maxSizeMB: 20,
          maxDurationSec: 45,
          maxRetries: 3
        }
      );

      logger.info('🏁 Upload complete', uploadResult.stats);

      Alert.alert(
        'Upload Complete!', 
        `${uploadResult.stats.successful} of ${uploadResult.stats.total} videos uploaded successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (uploadResult.stats.successful > 0) {
                navigation.navigate('Feed');
              }
            }
          }
        ]
      );

    } catch (error) {
      logger.error('Upload process failed', { error: error.message });
      Alert.alert('Upload Failed', handleError(error, 'VideoUploadScreen/handleUploadAll'));
    } finally {
      setIsUploading(false);
      setCurrentUploadingIndex(null);
      setUploadProgress({});
    }
  };

  /**
   * Remove a video from the list with S3 deletion if needed
   */
  const removeVideo = (index) => {
    const videoToRemove = videos[index];
    if (!videoToRemove) {
      Alert.alert('Error', handleError(createValidationError('REQUIRED_FIELD', 'videoToRemove'), 'VideoUploadScreen/removeVideo'));
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
              // If video has been uploaded, delete from S3
              if (uploadStatuses[index]?.uploaded && videoToRemove.fileName) {
                logger.info(`🗑️ Deleting video from S3: ${videoToRemove.fileName}`);

                const deleteResult = await deleteVideoFromS3(videoToRemove.fileName);
                
                if (!deleteResult.success) {
                  logger.warn('S3 deletion failed', { error: deleteResult.error });
                  Alert.alert(
                    'Warning', 
                    handleError(deleteResult.error, 'VideoUploadScreen/removeVideo') ||
                    'Video was removed locally but may still exist on server. Please contact support if needed.'
                  );
                }
              }

              // Remove from videoKeys set
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

              // Remove from arrays using video manager
              const newArrays = videoManager.removeVideo(index);
              setVideos(newArrays.videos);
              setVideoThumbnails(newArrays.thumbnails);
              setUploadStatuses(newArrays.statuses);
              setVideoUrls(newArrays.urls);
              
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
              
              logger.info(`✅ Video at index ${index} removed successfully`);

            } catch (error) {
              logger.error('Error deleting video', { error: error.message });
              Alert.alert('Error', handleError(error, 'VideoUploadScreen/removeVideo'));
            }
          },
        },
      ]
    );
  };

  /**
   * Move video position using video manager
   */
  const moveVideo = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= videos.length) return;
    
    const newArrays = videoManager.moveVideo(fromIndex, toIndex);
    setVideos(newArrays.videos);
    setVideoThumbnails(newArrays.thumbnails);
    setUploadStatuses(newArrays.statuses);
    setVideoUrls(newArrays.urls);

    logger.debug(`🔄 Moved video from position ${fromIndex} to ${toIndex}`);
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

                  {/* Video Controls */}
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

        {/* Upload Progress Display */}
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

      {/* Upload All Button */}
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
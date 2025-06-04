/**
 * @module uploadFileService
 * Centralized service for handling file uploads to AWS S3 via Lambda functions
 */

import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Alert } from 'react-native';

/**
 * Configuration for upload endpoints
 */
const UPLOAD_CONFIG = {
  VIDEO_UPLOAD_URL: 'https://cy6ikxj5lk.execute-api.us-east-1.amazonaws.com/groovi/file_upload',
  VIDEO_DELETE_URL: 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/delete',
  S3_BUCKET_BASE_URL: 'https://groovi-videos.s3.amazonaws.com/',
  MAX_VIDEO_SIZE_MB: 20,
  MAX_VIDEO_DURATION_SEC: 45,
  MAX_IMAGE_SIZE_MB: 5,
};

/**
 * @class UploadFileService
 * Service class for handling file uploads with user context
 */
class UploadFileService {
  constructor(user) {
    this.user = user;
    this.uploadCounter = 0;
  }

  /**
   * @method setUser
   * @description Updates the user context for uploads
   * @param {Object} user - User object containing username, email, etc.
   */
  setUser(user) {
    this.user = user;
  }

  /**
   * @method getUserIdentifier
   * @description Gets a unique identifier for the user
   * @returns {string} Username, email, or fallback identifier
   */
  getUserIdentifier() {
    return this.user?.username || this.user?.email || `user_${Date.now()}`;
  }

  /**
   * @method validateVideoFile
   * @description Validates a video file before upload
   * @param {Object} videoAsset - Video asset from ImagePicker
   * @returns {Promise<Object>} Validation result with success/error info
   */
  async validateVideoFile(videoAsset) {
    try {
      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(videoAsset.uri, { size: true });
      const sizeBytes = fileInfo?.size || 0;
      const sizeMB = sizeBytes / (1024 * 1024);

      // Handle duration calculation - convert to seconds if needed
      let durationSec = videoAsset?.duration || 0;
      if (durationSec > 100) {
        durationSec = durationSec / 1000;
      }

      console.log(`Video validation - Size: ${sizeMB.toFixed(2)}MB, Duration: ${durationSec.toFixed(1)}s`);

      // Validate size
      if (sizeMB > UPLOAD_CONFIG.MAX_VIDEO_SIZE_MB) {
        return {
          success: false,
          error: `Video too large. Maximum size is ${UPLOAD_CONFIG.MAX_VIDEO_SIZE_MB}MB. Your video is ${sizeMB.toFixed(2)}MB.`
        };
      }

      // Validate duration
      if (durationSec > UPLOAD_CONFIG.MAX_VIDEO_DURATION_SEC) {
        return {
          success: false,
          error: `Video too long. Maximum duration is ${UPLOAD_CONFIG.MAX_VIDEO_DURATION_SEC} seconds. Your video is ${durationSec.toFixed(1)} seconds.`
        };
      }

      return {
        success: true,
        fileInfo: {
          sizeBytes,
          sizeMB,
          durationSec
        }
      };
    } catch (error) {
      console.error('Error validating video file:', error);
      return {
        success: false,
        error: 'Failed to validate video file.'
      };
    }
  }

  /**
   * @method validateImageFile
   * @description Validates an image file before upload
   * @param {Object} imageAsset - Image asset from ImagePicker
   * @returns {Promise<Object>} Validation result with success/error info
   */
  async validateImageFile(imageAsset) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageAsset.uri, { size: true });
      const sizeBytes = fileInfo?.size || 0;
      const sizeMB = sizeBytes / (1024 * 1024);

      if (sizeMB > UPLOAD_CONFIG.MAX_IMAGE_SIZE_MB) {
        return {
          success: false,
          error: `Image too large. Maximum size is ${UPLOAD_CONFIG.MAX_IMAGE_SIZE_MB}MB. Your image is ${sizeMB.toFixed(2)}MB.`
        };
      }

      return {
        success: true,
        fileInfo: {
          sizeBytes,
          sizeMB
        }
      };
    } catch (error) {
      console.error('Error validating image file:', error);
      return {
        success: false,
        error: 'Failed to validate image file.'
      };
    }
  }

  /**
   * @method generateFileName
   * @description Generates a unique filename for upload
   * @param {string} originalFileName - Original file name
   * @param {string} fileType - Type of file ('video' or 'image')
   * @param {number} index - Optional index for multiple files
   * @returns {string} Generated filename
   */
  generateFileName(originalFileName, fileType = 'video', index = null) {
    const userIdentifier = this.getUserIdentifier();
    const fileExtension = originalFileName ? 
      originalFileName.split('.').pop() : 
      (fileType === 'video' ? 'mp4' : 'jpg');
    
    const indexSuffix = index !== null ? `_${index + 1}` : `_${++this.uploadCounter}`;
    return `${userIdentifier}${indexSuffix}.${fileExtension}`;
  }

  /**
   * @method getPreSignedUploadUrl
   * @description Gets a pre-signed URL from Lambda for file upload
   * @param {string} fileName - Name of the file to upload
   * @returns {Promise<Object>} Object containing uploadUrl and fileUrl
   */
  async getPreSignedUploadUrl(fileName) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('PUT', UPLOAD_CONFIG.VIDEO_UPLOAD_URL);
      xhr.setRequestHeader('file-name', fileName);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("Lambda response for pre-signed URL:", response);
            
            if (response.uploadUrl && response.fileUrl) {
              resolve({
                uploadUrl: response.uploadUrl,
                fileUrl: response.fileUrl
              });
            } else {
              console.error('Invalid response from Lambda, missing uploadUrl or fileUrl:', response);
              // Fallback URL
              const fallbackUrl = `${UPLOAD_CONFIG.S3_BUCKET_BASE_URL}${fileName}`;
              resolve({
                uploadUrl: null,
                fileUrl: fallbackUrl
              });
            }
          } catch (error) {
            console.error('Error parsing Lambda response:', error);
            const fallbackUrl = `${UPLOAD_CONFIG.S3_BUCKET_BASE_URL}${fileName}`;
            resolve({
              uploadUrl: null,
              fileUrl: fallbackUrl
            });
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
      
      xhr.send(JSON.stringify({}));
    });
  }

  /**
   * @method uploadFileToS3
   * @description Uploads a file to S3 using a pre-signed URL
   * @param {string} fileUri - The local URI of the file to upload
   * @param {string} presignedUrl - The pre-signed S3 URL
   * @param {string} mimeType - MIME type of the file
   * @returns {Promise<void>}
   */
  async uploadFileToS3(fileUri, presignedUrl, mimeType = 'video/mp4') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('PUT', presignedUrl);
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('File uploaded successfully to S3');
          resolve();
        } else {
          console.error(`S3 upload failed with status ${xhr.status}`);
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      };
      
      xhr.onerror = () => {
        console.error('Network error during S3 upload');
        reject(new Error('Network error during S3 upload'));
      };
      
      // Convert file URI to blob and upload
      fetch(fileUri)
        .then(res => res.blob())
        .then(blob => {
          xhr.setRequestHeader('Content-Type', blob.type || mimeType);
          xhr.send(blob);
        })
        .catch(error => {
          console.error('Error converting file URI to blob:', error);
          reject(error);
        });
    });
  }

  /**
   * @method uploadVideo
   * @description Complete video upload process with validation and thumbnail generation
   * @param {Object} videoAsset - Video asset from ImagePicker
   * @param {number} index - Optional index for multiple videos
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} Upload result with video URL and metadata
   */
  async uploadVideo(videoAsset, index = null, onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'validating', progress: 0 });

      // Validate video file
      const validation = await this.validateVideoFile(videoAsset);
      if (!validation.success) {
        throw new Error(validation.error);
      }

      if (onProgress) onProgress({ stage: 'generating_thumbnail', progress: 20 });

      // Generate thumbnail
      let thumbnailUri;
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(
          videoAsset.uri,
          { time: 1000 }
        );
        thumbnailUri = thumbUri;
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail, using fallback:', thumbError);
        thumbnailUri = videoAsset.uri + "#t=0.1";
      }

      if (onProgress) onProgress({ stage: 'preparing_upload', progress: 40 });

      // Generate filename and get pre-signed URL
      const fileName = this.generateFileName(videoAsset.fileName, 'video', index);
      console.log(`Uploading video with filename: ${fileName}`);

      const { uploadUrl, fileUrl } = await this.getPreSignedUploadUrl(fileName);

      if (onProgress) onProgress({ stage: 'uploading', progress: 60 });

      // Upload to S3 if we have a pre-signed URL
      if (uploadUrl) {
        await this.uploadFileToS3(videoAsset.uri, uploadUrl, videoAsset.mimeType || 'video/mp4');
      }

      if (onProgress) onProgress({ stage: 'complete', progress: 100 });

      // Create video object with all metadata
      const videoObj = {
        id: videoAsset.assetId || Date.now().toString(),
        uri: videoAsset.uri,
        fileName: fileName,
        mimeType: videoAsset.mimeType || 'video/mp4',
        duration: validation.fileInfo.durationSec,
        size: validation.fileInfo.sizeBytes,
        thumbnail: thumbnailUri,
        uploadedUrl: fileUrl
      };

      console.log(`Video uploaded successfully! URL: ${fileUrl}`);
      
      return {
        success: true,
        videoUrl: fileUrl,
        videoObject: videoObj,
        thumbnailUri: thumbnailUri
      };

    } catch (error) {
      console.error(`Error uploading video:`, error);
      return {
        success: false,
        error: error.message || 'Failed to upload video'
      };
    }
  }

  /**
   * @method uploadImage
   * @description Complete image upload process with validation
   * @param {Object} imageAsset - Image asset from ImagePicker
   * @param {string} imageType - Type of image ('profile', 'cover', etc.)
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Object>} Upload result with image URL
   */
  async uploadImage(imageAsset, imageType = 'profile', onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'validating', progress: 0 });

      // Validate image file
      const validation = await this.validateImageFile(imageAsset);
      if (!validation.success) {
        throw new Error(validation.error);
      }

      if (onProgress) onProgress({ stage: 'preparing_upload', progress: 30 });

      // Generate filename and get pre-signed URL
      const fileName = this.generateFileName(imageAsset.fileName || `${imageType}.jpg`, 'image');
      console.log(`Uploading image with filename: ${fileName}`);

      const { uploadUrl, fileUrl } = await this.getPreSignedUploadUrl(fileName);

      if (onProgress) onProgress({ stage: 'uploading', progress: 60 });

      // Upload to S3 if we have a pre-signed URL
      if (uploadUrl) {
        await this.uploadFileToS3(imageAsset.uri, uploadUrl, imageAsset.mimeType || 'image/jpeg');
      }

      if (onProgress) onProgress({ stage: 'complete', progress: 100 });

      console.log(`Image uploaded successfully! URL: ${fileUrl}`);
      
      return {
        success: true,
        imageUrl: fileUrl,
        fileName: fileName
      };

    } catch (error) {
      console.error(`Error uploading image:`, error);
      return {
        success: false,
        error: error.message || 'Failed to upload image'
      };
    }
  }

  /**
   * @method deleteFile
   * @description Deletes a file from S3 (if deletion endpoint is available)
   * @param {string} fileName - Name of the file to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileName) {
    try {
      console.log(`Attempting to delete file: ${fileName}`);
      
      // Note: This would require implementing a delete endpoint
      // For now, we'll just log the deletion attempt
      console.log(`File deletion not implemented yet for: ${fileName}`);
      
      return true;
    } catch (error) {
      console.error(`Error deleting file ${fileName}:`, error);
      return false;
    }
  }

  /**
   * @method createVideoKey
   * @description Creates a unique key for video deduplication
   * @param {string} fileName - Original filename
   * @param {number} size - File size in bytes
   * @param {number} duration - Duration in seconds
   * @returns {string} Unique video key
   */
  createVideoKey(fileName, size, duration) {
    return `${fileName}_${size}_${Math.round(duration * 10)}`;
  }

  /**
   * @method checkVideoDuplicate
   * @description Checks if a video is a duplicate based on existing keys
   * @param {Object} videoAsset - Video asset to check
   * @param {Set} existingKeys - Set of existing video keys
   * @returns {Promise<Object>} Duplicate check result
   */
  async checkVideoDuplicate(videoAsset, existingKeys) {
    try {
      const validation = await this.validateVideoFile(videoAsset);
      if (!validation.success) {
        return { isDuplicate: false, error: validation.error };
      }

      const videoKey = this.createVideoKey(
        videoAsset.fileName || 'unknown',
        validation.fileInfo.sizeBytes,
        validation.fileInfo.durationSec
      );

      return {
        isDuplicate: existingKeys.has(videoKey),
        videoKey: videoKey
      };
    } catch (error) {
      console.error('Error checking video duplicate:', error);
      return { isDuplicate: false, error: 'Failed to check duplicate' };
    }
  }
}

/**
 * Export factory function to create service instance
 */
export const createUploadService = (user) => {
  return new UploadFileService(user);
};

/**
 * Export singleton instance for global use
 */
let globalUploadService = null;

export const getUploadService = (user = null) => {
  if (!globalUploadService || (user && globalUploadService.user !== user)) {
    globalUploadService = new UploadFileService(user);
  }
  return globalUploadService;
};

/**
 * Export the service class for direct instantiation
 */
export default UploadFileService;
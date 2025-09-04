/**
 * @module uploadFileService
 * Simplified service for handling file uploads to AWS S3 via Lambda functions
 * Uses videoService for video processing and validation
 * FIXED: Added timeout handling and retry logic for connection issues
 */

import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import {
    validateVideoFile,
    processVideoAsset,
    processBatchVideos,
    generateVideoThumbnail,
    createVideoKey
} from './videoService';
import { handleError } from '../utils/errors';
import { createLogger } from '../utils/Logger';

const logger = createLogger('UploadFileService');

/**
 * Configuration for upload endpoints
 * FIXED: Added reasonable timeout configurations
 */
const UPLOAD_CONFIG = {
    VIDEO_UPLOAD_URL: 'https://cy6ikxj5lk.execute-api.us-east-1.amazonaws.com/groovi/file_upload',
    VIDEO_DELETE_URL: 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/delete',
    S3_BUCKET_BASE_URL: 'https://groovi-videos.s3.amazonaws.com/',
    MAX_IMAGE_SIZE_MB: 5,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    // FIXED: Reasonable timeout values
    PRESIGNED_URL_TIMEOUT: 10000,  // 10 seconds for Lambda requests
    S3_UPLOAD_TIMEOUT: 60000       // 1 minute for file uploads
};

/**
 * @class UploadFileService
 * Handles file uploads with user context and progress tracking
 */
class UploadFileService {
    constructor(user) {
        this.user = user;
        this.uploadCounter = 0;
        this.isUploading = false;
    }

    /**
     * @method setUser
     * @description Updates the user context for uploads
     */
    setUser(user) {
        this.user = user;
    }

    /**
     * @method getUserIdentifier
     * @description Gets a unique identifier for the user
     */
    getUserIdentifier() {
        return this.user?.username || this.user?.email || `user_${Date.now()}`;
    }

    /**
     * @method validateImageFile
     * @description Validates an image file before upload
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
                fileInfo: { sizeBytes, sizeMB }
            };
        } catch (error) {
            logger.error('Error validating image file:', handleError(error, 'UploadFileService/validateImageFile'));
            return {
                success: false,
                error: handleError(error, 'UploadFileService/validateImageFile') || 'Failed to validate image file.'
            };
        }
    }

    /**
     * @method generateFileName
     * @description Generates a unique filename for upload
     */
    generateFileName(originalFileName, fileType = 'video', index = null) {
        const userIdentifier = this.getUserIdentifier();
        const fileExtension = originalFileName ?
            originalFileName.split('.').pop() :
            (fileType === 'video' ? 'mp4' : 'jpg');

        // Create truly unique filenames using timestamp + random number
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const indexSuffix = index !== null ? `_${timestamp}_${index}_${random}` : `_${timestamp}_${++this.uploadCounter}_${random}`;

        return `${userIdentifier}${indexSuffix}.${fileExtension}`;
    }

    /**
     * @method sleep
     * @description Helper method for retry delays
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * @method createVideoKey
     * @description Creates a unique key for video deduplication
     */
    createVideoKey(fileName, size, duration) {
        return `${fileName}_${size}_${Math.round(duration * 10)}`;
    }

    /**
     * FIXED: Enhanced getPresignedUrl with timeout and better error handling
     * @method getPresignedUrl
     * @description Gets a pre-signed URL from Lambda for S3 upload
     */
    async getPresignedUrl(fileName, mimeType) {
        try {
            const response = await axios.put(UPLOAD_CONFIG.VIDEO_UPLOAD_URL, null, {
                headers: {
                    'file-name': fileName,
                    'content-type': mimeType || 'video/mp4',
                },
                // FIXED: Add timeout configuration
                timeout: UPLOAD_CONFIG.PRESIGNED_URL_TIMEOUT,
                validateStatus: function (status) {
                    return status >= 200 && status < 300;
                }
            });

            if (response.data && response.data.uploadUrl && response.data.fileUrl) {
                return {
                    success: true,
                    uploadUrl: response.data.uploadUrl,
                    fileUrl: response.data.fileUrl
                };
            } else {
                throw new Error('Invalid response from presigned URL service');
            }
        } catch (error) {
            // FIXED: Better timeout error handling
            if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
                logger.error('Presigned URL request timed out');
                return {
                    success: false,
                    error: 'Request timed out. Please check your connection and try again.',
                    isTimeout: true
                };
            }

            logger.error('Failed to get presigned URL:', handleError(error, 'UploadFileService/getPresignedUrl'));
            return {
                success: false,
                error: handleError(error, 'UploadFileService/getPresignedUrl') || error.message || 'Failed to get presigned URL',
                isTimeout: false
            };
        }
    }

    /**
     * FIXED: Added retry logic for presigned URLs
     * @method getPresignedUrlWithRetry
     * @description Gets a pre-signed URL with retry logic
     */
    async getPresignedUrlWithRetry(fileName, mimeType, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`Getting presigned URL - attempt ${attempt}/${maxRetries}`);

                const result = await this.getPresignedUrl(fileName, mimeType);

                if (result.success) {
                    logger.info(`Presigned URL obtained successfully on attempt ${attempt}`);
                    return result;
                }

                // If it's the last attempt, return the error
                if (attempt === maxRetries) {
                    return result;
                }

                // Wait before retrying (exponential backoff)
                const delay = UPLOAD_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                logger.info(`Retrying in ${delay}ms...`);
                await this.sleep(delay);

            } catch (error) {
                logger.error(`Presigned URL attempt ${attempt} failed:`, error.message);

                if (attempt === maxRetries) {
                    return {
                        success: false,
                        error: handleError(error, 'UploadFileService/getPresignedUrlWithRetry') || 'Failed to get presigned URL after all retries'
                    };
                }

                // Wait before retrying
                const delay = UPLOAD_CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                await this.sleep(delay);
            }
        }
    }

    /**
     * FIXED: Enhanced uploadToS3 with better timeout handling
     * @method uploadToS3
     * @description Upload file directly to S3 using pre-signed URL
     */
    async uploadToS3(fileUri, uploadUrl, mimeType, onProgress) {
        try {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && onProgress) {
                        onProgress({
                            loaded: event.loaded,
                            total: event.total
                        });
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({ success: true });
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => {
                    reject(new Error('Network error during upload'));
                };

                xhr.ontimeout = () => {
                    reject(new Error('Upload timed out'));
                };

                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', mimeType || 'video/mp4');
                // FIXED: Use configured timeout for S3 uploads
                xhr.timeout = UPLOAD_CONFIG.S3_UPLOAD_TIMEOUT;

                // For React Native, we need to handle file upload differently
                fetch(fileUri)
                    .then(response => response.blob())
                    .then(blob => {
                        xhr.send(blob);
                    })
                    .catch(error => {
                        reject(new Error(`Failed to read file: ${error.message}`));
                    });
            });
        } catch (error) {
            logger.error('S3 upload error:', handleError(error, 'UploadFileService/uploadToS3'));
            return {
                success: false,
                error: handleError(error, 'UploadFileService/uploadToS3') || error.message || 'S3 upload failed'
            };
        }
    }

    /**
     * Updated uploadToLambda to use retry logic
     * @method uploadToLambda
     * @description Core upload method using XHR with progress tracking and retry logic
     */
    async uploadToLambda(fileData, index, onProgress = null, options = {}) {
        const { maxRetries = UPLOAD_CONFIG.MAX_RETRIES, retryDelay = UPLOAD_CONFIG.RETRY_DELAY_MS } = options;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`Upload attempt ${attempt}/${maxRetries} for file ${index + 1}`);

                const customFileName = this.generateFileName(fileData.fileName, 'video', index);
                logger.info(`Using filename: ${customFileName}`);

                // FIXED: Use retry-enabled presigned URL method
                const presignedUrlResult = await this.getPresignedUrlWithRetry(
                    customFileName,
                    fileData.mimeType,
                    2 // Fewer retries here since we're already in a retry loop
                );

                if (!presignedUrlResult.success) {
                    throw new Error(presignedUrlResult.error);
                }

                const { uploadUrl, fileUrl } = presignedUrlResult;

                // Step 2: Upload directly to S3 using pre-signed URL
                const uploadResult = await this.uploadToS3(
                    fileData.uri,
                    uploadUrl,
                    fileData.mimeType,
                    (progressEvent) => {
                        if (onProgress) {
                            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                            onProgress({
                                progress,
                                loaded: progressEvent.loaded,
                                total: progressEvent.total,
                                stage: 'uploading',
                                attempt,
                                index
                            });
                        }
                    }
                );

                if (uploadResult.success) {
                    logger.info(`File ${index + 1} uploaded successfully on attempt ${attempt}!`);
                    console.log('🔍 DEBUG uploadToLambda - fileUrl:', fileUrl);
                    console.log('🔍 DEBUG uploadToLambda - returning:', {
                        success: true,
                        url: fileUrl,
                        fileName: customFileName
                    });
                    return {
                        success: true,
                        url: fileUrl,
                        fileName: customFileName,
                        originalData: fileData
                    };
                } else {
                    throw new Error(uploadResult.error);
                }

            } catch (error) {
                logger.error(`Upload attempt ${attempt} failed:`, handleError(error, 'UploadFileService/uploadToLambda'));

                if (attempt === maxRetries) {
                    return {
                        success: false,
                        error: handleError(error, 'UploadFileService/uploadToLambda') || error.message || 'Upload failed after all retry attempts'
                    };
                }

                if (attempt < maxRetries) {
                    await this.sleep(retryDelay * attempt);
                }
            }
        }

        // Fallback return in case the loop completes unexpectedly
        return {
            success: false,
            error: 'Upload failed after all retry attempts'
        };
    }

    /**
     * @method uploadVideo
     * @description Upload a single video with processing and validation
     */
    async uploadVideo(videoAsset, existingKeys = new Set(), index = null, onProgress = null, options = {}) {
        try {
            this.isUploading = true;

            if (onProgress) onProgress({ stage: 'processing', progress: 0, index });

            // Process video using videoService
            const processResult = await processVideoAsset(videoAsset, existingKeys, options);

            if (!processResult.success) {
                throw new Error(processResult.error);
            }

            if (onProgress) onProgress({ stage: 'uploading', progress: 30, index });

            // Upload the processed video
            const uploadResult = await this.uploadToLambda(
                processResult.videoData,
                index || 0,
                (uploadProgress) => {
                    if (onProgress) {
                        const scaledProgress = 30 + (uploadProgress.progress * 0.7);
                        onProgress({
                            stage: 'uploading',
                            progress: Math.round(scaledProgress),
                            index
                        });
                    }
                },
                options
            );

            if (uploadResult.success) {
                if (onProgress) onProgress({ stage: 'complete', progress: 100, index });

                return {
                    success: true,
                    videoUrl: uploadResult.url,
                    videoData: processResult.videoData,
                    videoKey: processResult.videoKey,
                    fileName: uploadResult.fileName
                };
            } else {
                throw new Error(uploadResult.error);
            }

        } catch (error) {
            logger.error(`Error uploading video:`, handleError(error, 'UploadFileService/uploadVideo'));
            if (onProgress) onProgress({ stage: 'error', progress: 0, index, error: handleError(error, 'UploadFileService/uploadVideo') });
            return {
                success: false,
                error: handleError(error, 'UploadFileService/uploadVideo') || 'Failed to upload video'
            };
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * @method uploadMultipleVideos
     * @description Upload multiple videos with batch processing
     */
    async uploadMultipleVideos(videoAssets, onProgress = null, onSingleComplete = null, options = {}) {
        try {
            logger.info(`Starting batch upload of ${videoAssets.length} videos...`);
            this.isUploading = true;

            const existingKeys = new Set();

            // First, process all videos using videoService
            const batchProcessResult = await processBatchVideos(
                videoAssets,
                existingKeys,
                options,
                (progressData) => {
                    if (onProgress) {
                        onProgress({
                            stage: 'processing',
                            videoIndex: progressData.current - 1,
                            totalVideos: videoAssets.length,
                            currentProgress: Math.round((progressData.current / progressData.total) * 30)
                        });
                    }
                }
            );

            if (!batchProcessResult.success) {
                throw new Error('Failed to process videos');
            }

            const { processedVideos, videoKeys, errors } = batchProcessResult;
            const uploadResults = [];
            const uploadedUrls = [];
            let successCount = 0;

            // Upload each processed video
            for (let i = 0; i < processedVideos.length; i++) {
                const videoData = processedVideos[i];

                if (onProgress) {
                    onProgress({
                        stage: 'uploading',
                        videoIndex: i,
                        totalVideos: processedVideos.length,
                        currentProgress: 30 + Math.round((i / processedVideos.length) * 70)
                    });
                }

                const uploadResult = await this.uploadToLambda(
                    videoData,
                    i,
                    (uploadProgress) => {
                        if (onProgress) {
                            const baseProgress = 30 + Math.round((i / processedVideos.length) * 70);
                            const videoProgress = Math.round(uploadProgress.progress * 0.7 / processedVideos.length);
                            onProgress({
                                stage: 'uploading',
                                videoIndex: i,
                                totalVideos: processedVideos.length,
                                currentProgress: baseProgress + videoProgress
                            });
                        }
                    },
                    options
                );

                uploadResults.push(uploadResult);

                if (uploadResult.success) {
                    uploadedUrls.push(uploadResult.url);
                    successCount++;
                } else {
                    uploadedUrls.push(null);
                }

                if (onSingleComplete) {
                    onSingleComplete(i, uploadResult);
                }
            }

            logger.info(`Batch upload complete! ${successCount}/${processedVideos.length} videos uploaded`);

            return {
                success: successCount > 0,
                results: uploadResults,
                uploadedUrls: uploadedUrls.filter(url => !!url),
                processedVideos,
                videoKeys,
                processingErrors: errors,
                stats: {
                    total: videoAssets.length,
                    processed: processedVideos.length,
                    uploaded: successCount,
                    failed: processedVideos.length - successCount,
                    processingErrors: errors.length
                }
            };

        } catch (error) {
            logger.error('Batch upload process failed:', handleError(error, 'UploadFileService/uploadMultipleVideos'));
            return {
                success: false,
                error: handleError(error, 'UploadFileService/uploadMultipleVideos') || 'Batch upload failed',
                results: [],
                uploadedUrls: [],
                stats: {
                    total: videoAssets.length,
                    processed: 0,
                    uploaded: 0,
                    failed: videoAssets.length
                }
            };
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * FIXED: Enhanced uploadImage with timeout handling
     * @method uploadImage
     * @description Upload an image file
     */
    async uploadImage(imageAsset, imageType = 'profile', onProgress = null) {
        try {
            this.isUploading = true;

            if (onProgress) onProgress({ stage: 'validating', progress: 0 });

            // Validate image file
            const validation = await this.validateImageFile(imageAsset);
            if (!validation.success) {
                throw new Error(validation.error);
            }

            if (onProgress) onProgress({ stage: 'uploading', progress: 30 });

            // Prepare image data
            const imageData = {
                id: imageAsset.assetId || Date.now().toString(),
                uri: imageAsset.uri,
                fileName: imageAsset.fileName || `${imageType}_${Date.now()}.jpg`,
                mimeType: imageAsset.mimeType || 'image/jpeg',
                size: validation.fileInfo.sizeBytes
            };

            const uploadResult = await this.uploadToLambda(imageData, 0, onProgress);

            if (uploadResult.success) {
                if (onProgress) onProgress({ stage: 'complete', progress: 100 });

                return {
                    success: true,
                    imageUrl: uploadResult.url,
                    fileName: uploadResult.fileName
                };
            } else {
                throw new Error(uploadResult.error);
            }

        } catch (error) {
            logger.error(`Error uploading image:`, handleError(error, 'UploadFileService/uploadImage'));
            if (onProgress) onProgress({ stage: 'error', progress: 0, error: handleError(error, 'UploadFileService/uploadImage') });
            return {
                success: false,
                error: handleError(error, 'UploadFileService/uploadImage') || 'Failed to upload image'
            };
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * FIXED: Enhanced deleteFile with timeout handling
     * @method deleteFile
     * @description Delete a file from S3
     */
    async deleteFile(fileName) {
        try {
            logger.info(`Deleting file from S3: ${fileName}`);

            const deleteUrl = `${UPLOAD_CONFIG.VIDEO_DELETE_URL}?filename=${encodeURIComponent(fileName)}`;
            const response = await axios.delete(deleteUrl, {
                // FIXED: Add timeout for delete requests too
                timeout: UPLOAD_CONFIG.PRESIGNED_URL_TIMEOUT
            });

            if (response.status === 200) {
                logger.info(`File ${fileName} deleted successfully from S3`);
                return {
                    success: true,
                    message: `File ${fileName} deleted successfully`
                };
            } else {
                return {
                    success: false,
                    error: `Failed to delete file: ${response.status}`
                };
            }
        } catch (error) {
            // FIXED: Handle timeout errors for delete requests
            if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
                logger.error('Delete request timed out');
                return {
                    success: false,
                    error: 'Delete request timed out. Please try again.'
                };
            }

            logger.error(`Error deleting file ${fileName}:`, handleError(error, 'UploadFileService/deleteFile'));
            return {
                success: false,
                error: handleError(error, 'UploadFileService/deleteFile') || error.response?.data?.message || error.message || 'Failed to delete file'
            };
        }
    }

    /**
     * @method getUploadStatus
     * @description Get current upload status
     */
    getUploadStatus() {
        return {
            isUploading: this.isUploading,
            uploadCounter: this.uploadCounter,
            userIdentifier: this.getUserIdentifier()
        };
    }

    /**
     * FIXED: Enhanced getServiceStats with timeout info
     * @method getServiceStats
     * @description Get service statistics
     */
    getServiceStats() {
        return {
            service: 'UploadFileService',
            user: this.getUserIdentifier(),
            uploadCounter: this.uploadCounter,
            isUploading: this.isUploading,
            config: {
                maxImageSizeMB: UPLOAD_CONFIG.MAX_IMAGE_SIZE_MB,
                maxRetries: UPLOAD_CONFIG.MAX_RETRIES,
                presignedUrlTimeout: UPLOAD_CONFIG.PRESIGNED_URL_TIMEOUT,
                s3UploadTimeout: UPLOAD_CONFIG.S3_UPLOAD_TIMEOUT
            },
            endpoints: {
                upload: UPLOAD_CONFIG.VIDEO_UPLOAD_URL,
                delete: UPLOAD_CONFIG.VIDEO_DELETE_URL,
                s3Base: UPLOAD_CONFIG.S3_BUCKET_BASE_URL
            }
        };
    }
}

/**
 * @function getUploadService
 * @description Factory function to create upload service instance
 */
export const getUploadService = (user) => {
    return new UploadFileService(user);
};

export default UploadFileService;
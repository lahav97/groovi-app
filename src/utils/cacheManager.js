// src/utils/cacheManager.js
import * as FileSystem from 'expo-file-system';

/**
 * Manages video cache by removing oldest files when size limit is reached
 * @param {number} maxCacheSizeMB - Maximum cache size in MB
 */
export const manageCacheSize = async (maxCacheSizeMB = 200) => {
  try {
    const maxCacheBytes = maxCacheSizeMB * 1024 * 1024; // Convert MB to bytes
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
    if (!dirInfo.exists) {
      return;
    }
    
    const files = await FileSystem.readDirectoryAsync(`${FileSystem.cacheDirectory}videos`);
    
    // Get file info with sizes and timestamps
    const fileInfoPromises = files.map(async (filename) => {
      const fileUri = `${FileSystem.cacheDirectory}videos/${filename}`;
      const info = await FileSystem.getInfoAsync(fileUri);
      return {
        uri: fileUri,
        name: filename,
        modTime: info.modificationTime || 0,
        size: info.size || 0
      };
    });
    
    const fileInfos = await Promise.all(fileInfoPromises);
    
    const totalCacheBytes = fileInfos.reduce((sum, file) => sum + file.size, 0);
    console.log(`Current cache size: ${(totalCacheBytes / (1024 * 1024)).toFixed(2)}MB`);
    
    // If cache exceeds limit, remove oldest files until below limit
    if (totalCacheBytes > maxCacheBytes) {
      console.log(`Cache size limit exceeded (${(totalCacheBytes / (1024 * 1024)).toFixed(2)}MB/${maxCacheSizeMB}MB). Cleaning up.`);
      
      // Sort files by modification time (oldest first)
      const sortedFiles = fileInfos.sort((a, b) => a.modTime - b.modTime);
      
      let bytesToFree = totalCacheBytes - maxCacheBytes;
      let freedBytes = 0;
      
      for (const file of sortedFiles) {
        if (freedBytes >= bytesToFree) break;
        
        console.log(`Removing cached video: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
        freedBytes += file.size;
      }
      
      console.log(`Cache cleanup complete. Freed ${(freedBytes / (1024 * 1024)).toFixed(2)}MB.`);
    }
  } catch (error) {
    console.error('Error managing cache size:', error);
  }
};

/**
 * Calculate current video cache size
 * @returns {Promise<number>} Size in MB
 */
export const getCurrentCacheSize = async () => {
  try {
    // Check if videos directory exists
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
    if (!dirInfo.exists) {
      return 0; // No cache directory yet
    }
    
    // Read all cached video files
    const files = await FileSystem.readDirectoryAsync(`${FileSystem.cacheDirectory}videos`);
    
    // Get file sizes
    const fileInfoPromises = files.map(async (filename) => {
      const fileUri = `${FileSystem.cacheDirectory}videos/${filename}`;
      const info = await FileSystem.getInfoAsync(fileUri);
      return info.size || 0;
    });
    
    const fileSizes = await Promise.all(fileInfoPromises);
    
    // Calculate total size in MB
    const totalBytes = fileSizes.reduce((sum, size) => sum + size, 0);
    return totalBytes / (1024 * 1024);
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return 0;
  }
};

/**
 * Clear all cached videos
 * @returns {Promise<boolean>} Success status
 */
export const clearVideoCache = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}videos`);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}videos`, { idempotent: true });
      await FileSystem.makeDirectoryAsync(`${FileSystem.cacheDirectory}videos`, { intermediates: true });
      console.log('Video cache cleared successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error clearing video cache:', error);
    return false;
  }
};
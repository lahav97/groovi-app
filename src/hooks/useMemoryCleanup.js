/**
 * @module useMemoryCleanup
 * Hook for automatic memory cleanup when components unmount or lose focus
 * Specifically designed to prevent 2GB memory leaks from video components
 */

import { useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AppMemoryManager from '../utils/AppMemoryManager';
import { clearVideoCache } from './useVideoCache';
import BackgroundDataService from '../services/BackgroundDataService';

/**
 * Hook for automatic memory cleanup on screen navigation
 * @param {string} screenName - Name of the screen for logging
 * @param {Object} options - Configuration options
 * @returns {Object} Cleanup utilities
 */
export const useMemoryCleanup = (screenName = 'Unknown', options = {}) => {
  const {
    cleanupOnUnfocus = true,
    cleanupOnUnmount = true,
    includeVideoCleanup = true,
    includeCacheCleanup = true,
    includeRequestCleanup = true,
    forceGC = true,
    cleanupDelay = 0, // Delay in ms before cleanup
  } = options;

  const cleanupTimeoutRef = useRef(null);
  const hasCleanedUp = useRef(false);

  /**
   * Comprehensive cleanup function
   */
  const performCleanup = useCallback((reason = 'unknown') => {
    if (hasCleanedUp.current) {
      console.log(`⚠️ ${screenName} - Cleanup already performed, skipping`);
      return;
    }

    console.log(`♻️ ${screenName} - Starting cleanup: ${reason}`);
    hasCleanedUp.current = true;

    try {
      // Clear any pending cleanup timeouts
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }

      // 1. Cancel background requests
      if (includeRequestCleanup) {
        BackgroundDataService.cancelAllRequests?.();
        console.log(`🛑 ${screenName} - Background requests cancelled`);
      }

      // 2. Clear video cache and refs
      if (includeVideoCleanup) {
        clearVideoCache();
        console.log(`🎬 ${screenName} - Video cache cleared`);
      }

      // 3. Clear general caches if needed
      if (includeCacheCleanup) {
        AppMemoryManager.forceCleanup?.(screenName);
        console.log(`🧹 ${screenName} - Cache cleanup triggered`);
      }

      // 4. Force garbage collection
      if (forceGC && global.gc) {
        setTimeout(() => {
          global.gc();
          console.log(`🗑️ ${screenName} - Garbage collection completed`);
        }, 100);
      }

      console.log(`✅ ${screenName} - Cleanup completed`);

    } catch (error) {
      console.error(`❌ ${screenName} - Cleanup error:`, error);
    }
  }, [screenName, includeVideoCleanup, includeCacheCleanup, includeRequestCleanup, forceGC]);

  /**
   * Delayed cleanup function
   */
  const scheduleCleanup = useCallback((reason = 'scheduled') => {
    if (cleanupDelay > 0) {
      console.log(`⏱️ ${screenName} - Scheduling cleanup in ${cleanupDelay}ms`);
      cleanupTimeoutRef.current = setTimeout(() => {
        performCleanup(reason);
      }, cleanupDelay);
    } else {
      performCleanup(reason);
    }
  }, [performCleanup, cleanupDelay, screenName]);

  /**
   * Manual cleanup trigger
   */
  const manualCleanup = useCallback((reason = 'manual') => {
    hasCleanedUp.current = false; // Allow manual cleanup even if already cleaned up
    performCleanup(reason);
  }, [performCleanup]);

  /**
   * Reset cleanup flag (useful for reusable components)
   */
  const resetCleanupFlag = useCallback(() => {
    hasCleanedUp.current = false;
    console.log(`🔄 ${screenName} - Cleanup flag reset`);
  }, [screenName]);

  // Focus/Unfocus cleanup
  useFocusEffect(
    useCallback(() => {
      console.log(`📱 ${screenName} - Screen focused`);
      resetCleanupFlag();

      return () => {
        if (cleanupOnUnfocus) {
          console.log(`📱 ${screenName} - Screen unfocused`);
          scheduleCleanup('unfocus');
        }
      };
    }, [screenName, cleanupOnUnfocus, scheduleCleanup, resetCleanupFlag])
  );

  // Mount/Unmount cleanup
  useEffect(() => {
    console.log(`🚀 ${screenName} - Component mounted`);

    return () => {
      if (cleanupOnUnmount) {
        console.log(`💥 ${screenName} - Component unmounting`);
        scheduleCleanup('unmount');
      }
    };
  }, [screenName, cleanupOnUnmount, scheduleCleanup]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, []);

  return {
    manualCleanup,
    resetCleanupFlag,
    isCleanedUp: () => hasCleanedUp.current,
  };
};

/**
 * Lightweight version for non-video screens
 */
export const useLightMemoryCleanup = (screenName = 'Unknown') => {
  return useMemoryCleanup(screenName, {
    includeVideoCleanup: false,
    includeCacheCleanup: false,
    forceGC: false,
  });
};

/**
 * Heavy-duty version for video screens
 */
export const useHeavyMemoryCleanup = (screenName = 'Unknown') => {
  return useMemoryCleanup(screenName, {
    cleanupOnUnfocus: true,
    cleanupOnUnmount: true,
    includeVideoCleanup: true,
    includeCacheCleanup: true,
    includeRequestCleanup: true,
    forceGC: true,
    cleanupDelay: 100, // Small delay to ensure smooth navigation
  });
};

export default useMemoryCleanup;

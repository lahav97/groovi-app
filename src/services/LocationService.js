import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError } from '../utils/errors';

// Location preference keys
const LOCATION_PREFERENCES_KEY = 'groovi_location_preferences';
const USER_LOCATION_KEY = 'groovi_user_location';

/**
 * @typedef {Object} DetailedAddress
 * @property {string} street - Street name
 * @property {string} streetNumber - Street number
 * @property {string} city - City name
 * @property {string} region - State/region
 * @property {string} country - Country name
 * @property {string} postalCode - Postal/zip code
 * @property {string} formattedAddress - Complete formatted address
 * @property {number} latitude - Latitude coordinate
 * @property {number} longitude - Longitude coordinate
 */

/**
 * @typedef {Object} LocationPreferences
 * @property {number} maxDistance - Maximum distance in kilometers
 * @property {boolean} locationEnabled - Whether location filtering is enabled
 * @property {string} unit - Distance unit ('km' or 'miles')
 */

/**
 * Location service for handling GPS location and address management
 */
class LocationService {
  /**
   * Request location permissions from the user
   * @returns {Promise<{granted: boolean, status: string}>}
   */
  static async requestPermissions() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return {
        granted: status === 'granted',
        status: status
      };
    } catch (error) {
      console.error('Error requesting location permissions:', handleError(error, 'LocationService/requestPermissions'));
      return {
        granted: false,
        status: 'error',
        error: handleError(error, 'LocationService/requestPermissions') || error.message
      };
    }
  }

  /**
   * Get current GPS position
   * @returns {Promise<{success: boolean, coordinates?: Object, error?: string}>}
   */
  static async getCurrentPosition() {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 1,
      });
      
      return {
        success: true,
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
      };
    } catch (error) {
      console.error('Error getting current position:', handleError(error, 'LocationService/getCurrentPosition'));
      return {
        success: false,
        error: handleError(error, 'LocationService/getCurrentPosition') || error.message
      };
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @param {string} unit - Unit of measurement ('km' or 'miles')
   * @returns {number} Distance between coordinates
   */
  static calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    const R = unit === 'miles' ? 3959 : 6371; // Earth's radius in miles or kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Convert degrees to radians
   * @private
   */
  static deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Convert coordinates to detailed address information
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @returns {Promise<{success: boolean, address?: DetailedAddress, error?: string}>}
   */
  static async getDetailedAddress(latitude, longitude) {
    try {
      const addressArray = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (addressArray.length === 0) {
        return {
          success: false,
          error: 'No address found for these coordinates'
        };
      }

      const rawAddress = addressArray[0];
      
      // Extract and format address components
      const detailedAddress = {
        street: rawAddress.street || '',
        streetNumber: rawAddress.streetNumber || '',
        city: rawAddress.city || rawAddress.subregion || '',
        region: rawAddress.region || '',
        country: rawAddress.country || '',
        postalCode: rawAddress.postalCode || '',
        latitude: latitude,
        longitude: longitude,
        formattedAddress: this.formatFullAddress(rawAddress)
      };

      return {
        success: true,
        address: detailedAddress
      };
    } catch (error) {
      console.error('Error getting detailed address:', handleError(error, 'LocationService/getDetailedAddress'));
      return {
        success: false,
        error: handleError(error, 'LocationService/getDetailedAddress') || error.message
      };
    }
  }

  /**
   * Get current location with detailed address
   * @returns {Promise<{success: boolean, address?: DetailedAddress, error?: string}>}
   */
  static async getCurrentLocationWithAddress() {
    try {
      // First check permissions
      const permissionResult = await this.requestPermissions();
      if (!permissionResult.granted) {
        return {
          success: false,
          error: 'Location permission not granted',
          permissionStatus: permissionResult.status
        };
      }

      // Get current position
      const positionResult = await this.getCurrentPosition();
      if (!positionResult.success) {
        return {
          success: false,
          error: positionResult.error
        };
      }

      // Get detailed address
      const addressResult = await this.getDetailedAddress(
        positionResult.coordinates.latitude,
        positionResult.coordinates.longitude
      );

      if (!addressResult.success) {
        return {
          success: false,
          error: addressResult.error
        };
      }

      return {
        success: true,
        address: addressResult.address
      };
    } catch (error) {
      console.error('Error getting current location with address:', handleError(error, 'LocationService/getCurrentLocationWithAddress'));
      return {
        success: false,
        error: handleError(error, 'LocationService/getCurrentLocationWithAddress') || error.message
      };
    }
  }

  /**
   * Format a complete address string from address components
   * @param {Object} addressComponents - Raw address components from reverse geocoding
   * @returns {string} Formatted address string
   */
  static formatFullAddress(addressComponents) {
    const parts = [];
    
    // Add street number and street name
    if (addressComponents.streetNumber && addressComponents.street) {
      parts.push(`${addressComponents.streetNumber} ${addressComponents.street}`);
    } else if (addressComponents.street) {
      parts.push(addressComponents.street);
    }
    
    // Add city
    if (addressComponents.city) {
      parts.push(addressComponents.city);
    } else if (addressComponents.subregion) {
      parts.push(addressComponents.subregion);
    }
    
    // Add region/state
    if (addressComponents.region) {
      parts.push(addressComponents.region);
    }
    
    // Add postal code
    if (addressComponents.postalCode) {
      parts.push(addressComponents.postalCode);
    }
    
    // Add country
    if (addressComponents.country) {
      parts.push(addressComponents.country);
    }
    
    return parts.filter(part => part && part.trim()).join(', ');
  }

  /**
   * Save user's location preferences
   * @param {LocationPreferences} preferences - Location preferences object
   */
  static async saveLocationPreferences(preferences) {
    try {
      await AsyncStorage.setItem(LOCATION_PREFERENCES_KEY, JSON.stringify(preferences));
      return { success: true };
    } catch (error) {
      console.error('Error saving location preferences:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's location preferences
   * @returns {Promise<LocationPreferences>} Location preferences with defaults
   */
  static async getLocationPreferences() {
    try {
      const stored = await AsyncStorage.getItem(LOCATION_PREFERENCES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      // Default preferences
      const defaults = {
        maxDistance: 50, // 50km default radius
        locationEnabled: true,
        unit: 'km'
      };

      // Save defaults for future use
      await this.saveLocationPreferences(defaults);
      return defaults;
    } catch (error) {
      console.error('Error getting location preferences:', error);
      // Return safe defaults on error
      return {
        maxDistance: 50,
        locationEnabled: true,
        unit: 'km'
      };
    }
  }

  /**
   * Save user's current location for matching
   * @param {DetailedAddress} locationData - User's location data
   */
  static async saveUserLocation(locationData) {
    try {
      const locationToSave = {
        ...locationData,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify(locationToSave));
      return { success: true };
    } catch (error) {
      console.error('Error saving user location:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's saved location
   * @returns {Promise<DetailedAddress|null>} Saved location data or null
   */
  static async getSavedUserLocation() {
    try {
      const stored = await AsyncStorage.getItem(USER_LOCATION_KEY);
      if (stored) {
        const location = JSON.parse(stored);
        // Check if location is not too old (24 hours)
        if (location.timestamp && (Date.now() - location.timestamp) < 24 * 60 * 60 * 1000) {
          return location;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting saved location:', error);
      return null;
    }
  }

  /**
   * Get location for matching - tries saved location first, then current location
   * @returns {Promise<{success: boolean, location?: DetailedAddress, error?: string}>}
   */
  static async getLocationForMatching() {
    try {
      // First try to get saved location
      const savedLocation = await this.getSavedUserLocation();
      if (savedLocation) {
        return {
          success: true,
          location: savedLocation
        };
      }

      // If no saved location, get current location
      const locationResult = await this.getCurrentLocationWithAddress();
      if (locationResult.success) {
        // Save for future use
        await this.saveUserLocation(locationResult.address);
        return {
          success: true,
          location: locationResult.address
        };
      }

      return {
        success: false,
        error: locationResult.error || 'Unable to get location'
      };
    } catch (error) {
      console.error('Error getting location for matching:', error);
      return {
        success: false,
        error: error.message || 'Location service error'
      };
    }
  }
}

export default LocationService;


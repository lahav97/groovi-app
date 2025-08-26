import * as Location from 'expo-location';
import { handleError } from '../utils/errors';

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
}

export default LocationService;
import * as Location from 'expo-location';

/**
 * @typedef {Object} DetailedAddress
 * @property {string} street - Street name
 * @property {string} streetNumber - House/building number
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
      console.error('Error requesting location permissions:', error);
      return {
        granted: false,
        status: 'error',
        error: error.message
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
      console.error('Error getting current position:', error);
      return {
        success: false,
        error: error.message
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
      console.error('Error getting detailed address:', error);
      return {
        success: false,
        error: error.message
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
      console.error('Error getting current location with address:', error);
      return {
        success: false,
        error: error.message
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
   * Create a formatted address string from individual components
   * @param {DetailedAddress} address - Address object with individual components
   * @returns {string} Formatted address string
   */
  static formatAddressFromComponents(address) {
    const parts = [];
    
    if (address.streetNumber && address.street) {
      parts.push(`${address.streetNumber} ${address.street}`);
    } else if (address.street) {
      parts.push(address.street);
    }
    
    if (address.city) parts.push(address.city);
    if (address.region) parts.push(address.region);
    if (address.postalCode) parts.push(address.postalCode);
    if (address.country) parts.push(address.country);
    
    return parts.filter(part => part && part.trim()).join(', ');
  }

  /**
   * Validate address components
   * @param {DetailedAddress} address - Address to validate
   * @returns {Object} Validation result with errors
   */
  static validateAddress(address) {
    const errors = {};
    
    if (!address.city || address.city.trim() === '') {
      errors.city = 'City is required';
    }
    
    if (!address.country || address.country.trim() === '') {
      errors.country = 'Country is required';
    }
    
    // Street is optional but if provided, should not be empty
    if (address.street && address.street.trim() === '') {
      errors.street = 'Street cannot be empty if provided';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Search for addresses based on text input (for autocomplete)
   * @param {string} query - Search query
   * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
   */
  static async searchAddresses(query) {
    try {
      if (!query || query.trim().length < 3) {
        return {
          success: true,
          results: []
        };
      }

      // Use geocoding to search for addresses
      const results = await Location.geocodeAsync(query);
      
      const formattedResults = await Promise.all(
        results.map(async (result) => {
          const addressResult = await this.getDetailedAddress(
            result.latitude,
            result.longitude
          );
          
          return addressResult.success ? addressResult.address : null;
        })
      );

      return {
        success: true,
        results: formattedResults.filter(result => result !== null)
      };
    } catch (error) {
      console.error('Error searching addresses:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default LocationService;
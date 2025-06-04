import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LocationService from '../../services/LocationService';

/**
 * @component AddressInput
 * @description A comprehensive address input component that allows users to:
 * 1. Automatically detect their current location
 * 2. Manually edit any part of the address
 * 3. Switch between automatic and manual modes
 * @param {Object} props
 * @param {Object} props.address - Current address object
 * @param {Function} props.onAddressChange - Callback when address changes
 * @param {boolean} props.autoDetectInitial - Whether to auto-detect on mount
 * @param {string} props.placeholder - Placeholder text for inputs
 */
const AddressInput = ({ 
  address = {}, 
  onAddressChange, 
  autoDetectInitial = true,
  placeholder = 'Enter address...' 
}) => {
  const isDark = useColorScheme() === 'dark';
  const [isAutoMode, setIsAutoMode] = useState(autoDetectInitial);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedView, setExpandedView] = useState(false);
  const [localAddress, setLocalAddress] = useState({
    street: '',
    streetNumber: '',
    city: '',
    region: '',
    country: '',
    postalCode: '',
    formattedAddress: '',
    ...address
  });

  // Auto-detect location on component mount if enabled
  useEffect(() => {
    if (autoDetectInitial && isAutoMode) {
      handleAutoDetect();
    }
  }, []);

  // Update local state when address prop changes
  useEffect(() => {
    setLocalAddress(prev => ({
      ...prev,
      ...address
    }));
  }, [address]);

  /**
   * Handle automatic location detection
   */
  const handleAutoDetect = async () => {
    setIsLoading(true);
    try {
      const result = await LocationService.getCurrentLocationWithAddress();
      
      if (result.success) {
        const newAddress = result.address;
        setLocalAddress(newAddress);
        onAddressChange?.(newAddress);
        Alert.alert('Location Detected', 'Your current address has been detected successfully!');
      } else {
        Alert.alert(
          'Location Error', 
          result.error || 'Could not detect your location. Please enter it manually.',
          [
            {
              text: 'Enter Manually',
              onPress: () => setIsAutoMode(false)
            },
            {
              text: 'Try Again',
              onPress: () => handleAutoDetect()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error auto-detecting location:', error);
      Alert.alert('Error', 'Failed to detect location. Please enter manually.');
      setIsAutoMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle switching between auto and manual modes
   */
  const handleModeSwitch = () => {
    if (isAutoMode) {
      setIsAutoMode(false);
      setExpandedView(true);
    } else {
      setIsAutoMode(true);
      handleAutoDetect();
    }
  };

  /**
   * Handle changes to individual address components
   */
  const handleAddressComponentChange = (field, value) => {
    const updatedAddress = {
      ...localAddress,
      [field]: value
    };
    
    // Update formatted address when components change
    if (!isAutoMode) {
      updatedAddress.formattedAddress = LocationService.formatAddressFromComponents(updatedAddress);
    }
    
    setLocalAddress(updatedAddress);
    onAddressChange?.(updatedAddress);
  };

  /**
   * Toggle expanded view for detailed editing
   */
  const toggleExpandedView = () => {
    setExpandedView(!expandedView);
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? '#222' : '#eee',
      color: isDark ? '#fff' : '#000',
      borderColor: isDark ? '#444' : '#ddd',
    }
  ];

  const textColor = isDark ? '#fff' : '#000';
  const secondaryTextColor = isDark ? '#aaa' : '#666';

  return (
    <View style={styles.container}>
      {/* Mode Toggle Header */}
      <View style={styles.header}>
        <Text style={[styles.label, { color: textColor }]}>Location</Text>
        <TouchableOpacity 
          style={styles.modeToggle} 
          onPress={handleModeSwitch}
          disabled={isLoading}
        >
          <Ionicons 
            name={isAutoMode ? 'location' : 'create'} 
            size={20} 
            color={isAutoMode ? '#4CAF50' : '#333'} 
          />
          <Text style={[styles.modeText, { color: isAutoMode ? '#4CAF50' : '#333' }]}>
            {isAutoMode ? 'Auto-Detect' : 'Manual Entry'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
            Detecting your location...
          </Text>
        </View>
      )}

      {/* Auto Mode - Display detected address */}
      {isAutoMode && !isLoading && (
        <View style={styles.autoModeContainer}>
          <Text style={[styles.detectedAddress, { color: textColor }]}>
            {localAddress.formattedAddress || 'No address detected'}
          </Text>
          {localAddress.formattedAddress && (
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => setIsAutoMode(false)}
            >
              <Ionicons name="create-outline" size={16} color="#2196F3" />
              <Text style={styles.editButtonText}>Edit Address</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Manual Mode - Editable inputs */}
      {!isAutoMode && (
        <View style={styles.manualModeContainer}>
          {/* Simple View - Single formatted address input */}
          {!expandedView && (
            <View>
              <TextInput
                style={inputStyle}
                placeholder="Enter your full address"
                placeholderTextColor={secondaryTextColor}
                value={localAddress.formattedAddress}
                onChangeText={(value) => handleAddressComponentChange('formattedAddress', value)}
                multiline
              />
              <TouchableOpacity 
                style={styles.expandButton} 
                onPress={toggleExpandedView}
              >
                <Text style={styles.expandButtonText}>Enter detailed address</Text>
                <Ionicons name="chevron-down" size={16} color="#333" />
              </TouchableOpacity>
            </View>
          )}

          {/* Expanded View - Individual address components */}
          {expandedView && (
            <View style={styles.expandedContainer}>
              <TouchableOpacity 
                style={styles.collapseButton} 
                onPress={toggleExpandedView}
              >
                <Text style={styles.expandButtonText}>Simple address entry</Text>
                <Ionicons name="chevron-up" size={16} color="#2196F3" />
              </TouchableOpacity>

              <View style={styles.rowContainer}>
                <TextInput
                  style={[inputStyle, styles.streetNumberInput]}
                  placeholder="House #"
                  placeholderTextColor={secondaryTextColor}
                  value={localAddress.streetNumber}
                  onChangeText={(value) => handleAddressComponentChange('streetNumber', value)}
                />
                <TextInput
                  style={[inputStyle, styles.streetInput]}
                  placeholder="Street name"
                  placeholderTextColor={secondaryTextColor}
                  value={localAddress.street}
                  onChangeText={(value) => handleAddressComponentChange('street', value)}
                />
              </View>

              <TextInput
                style={inputStyle}
                placeholder="City"
                placeholderTextColor={secondaryTextColor}
                value={localAddress.city}
                onChangeText={(value) => handleAddressComponentChange('city', value)}
              />

              <View style={styles.rowContainer}>
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="State/Region"
                  placeholderTextColor={secondaryTextColor}
                  value={localAddress.region}
                  onChangeText={(value) => handleAddressComponentChange('region', value)}
                />
                <TextInput
                  style={[inputStyle, styles.halfInput]}
                  placeholder="Postal Code"
                  placeholderTextColor={secondaryTextColor}
                  value={localAddress.postalCode}
                  onChangeText={(value) => handleAddressComponentChange('postalCode', value)}
                />
              </View>

              <TextInput
                style={inputStyle}
                placeholder="Country"
                placeholderTextColor={secondaryTextColor}
                value={localAddress.country}
                onChangeText={(value) => handleAddressComponentChange('country', value)}
              />
            </View>
          )}
        </View>
      )}

      {/* Address Preview (for manual mode with detailed inputs) */}
      {!isAutoMode && expandedView && (
        <View style={styles.previewContainer}>
          <Text style={[styles.previewLabel, { color: secondaryTextColor }]}>
            Preview:
          </Text>
          <Text style={[styles.previewText, { color: textColor }]}>
            {LocationService.formatAddressFromComponents(localAddress) || 'Enter address details above'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
    modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 0,                
    shadowColor: '#000',     
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    },
  modeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
  },
  autoModeContainer: {
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  detectedAddress: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  editButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  manualModeContainer: {
    marginTop: 8,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: -6,
    marginBottom: 6,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 6,
    fontWeight: '500',
  },
  expandedContainer: {
    marginTop: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  streetNumberInput: {
    flex: 0.3,
  },
  streetInput: {
    flex: 0.7,
  },
  halfInput: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default AddressInput;
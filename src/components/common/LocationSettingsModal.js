import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Switch,
    useColorScheme
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { COLORS } from '../../styles/theme';
import LocationService from '../../services/LocationService';

const LocationSettingsModal = ({
    visible,
    onClose,
    onLocationUpdate,
    initialDistance = 50,
    initialLocationEnabled = true
}) => {
    const isDark = useColorScheme() === 'dark';
    const backgroundColor = isDark ? '#1c1c1e' : '#fff';
    const textColor = isDark ? '#fff' : '#000';

    const [distance, setDistance] = useState(initialDistance);
    const [locationEnabled, setLocationEnabled] = useState(initialLocationEnabled);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // Get user's current location when component mounts
    useEffect(() => {
        if (visible && locationEnabled) {
            getCurrentLocation();
        }
    }, [visible, locationEnabled]);

    const getCurrentLocation = async () => {
        setLocationLoading(true);
        setLocationError(null);

        try {
            const locationResult = await LocationService.getLocationForMatching();

            if (locationResult.success) {
                setCurrentLocation(locationResult.location);
                console.log('📍 Current location obtained:', {
                    city: locationResult.location.city,
                    coordinates: `${locationResult.location.latitude}, ${locationResult.location.longitude}`
                });
            } else {
                setLocationError(locationResult.error || 'Unable to get location');
                console.warn('Location error:', locationResult.error);
            }
        } catch (error) {
            setLocationError('Failed to get location');
            console.error('Location error:', error);
        } finally {
            setLocationLoading(false);
        }
    };

    const handleLocationToggle = (enabled) => {
        setLocationEnabled(enabled);
        if (enabled && !currentLocation) {
            getCurrentLocation();
        }
    };

    const handleApplySettings = () => {
        const locationOptions = locationEnabled && currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            maxDistance: distance,
            unit: 'km'
        } : null;

        onLocationUpdate({
            enabled: locationEnabled,
            distance: distance,
            locationOptions: locationOptions,
            currentLocation: currentLocation
        });

        onClose();
    };

    const renderLocationStatus = () => {
        if (!locationEnabled) {
            return (
                <View style={styles.locationStatus}>
                    <Ionicons name="location-outline" size={20} color="#999" />
                    <Text style={[styles.locationStatusText, { color: '#999' }]}>
                        Location filtering disabled
                    </Text>
                </View>
            );
        }

        if (locationLoading) {
            return (
                <View style={styles.locationStatus}>
                    <Ionicons name="refresh" size={20} color={COLORS.static.primaryGradient[0]} />
                    <Text style={[styles.locationStatusText, { color: textColor }]}>
                        Getting your location...
                    </Text>
                </View>
            );
        }

        if (locationError) {
            return (
                <View style={styles.locationStatus}>
                    <Ionicons name="warning" size={20} color="#ff6b6b" />
                    <Text style={[styles.locationStatusText, { color: '#ff6b6b' }]}>
                        {locationError}
                    </Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={getCurrentLocation}
                    >
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (currentLocation) {
            return (
                <View style={styles.locationStatus}>
                    <Ionicons name="location" size={20} color="#4CAF50" />
                    <Text style={[styles.locationStatusText, { color: textColor }]}>
                        {currentLocation.city || 'Current location'}
                    </Text>
                </View>
            );
        }

        return null;
    };

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: textColor }]}>
                        Location Settings
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>

                {/* Location Toggle */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <Text style={[styles.label, { color: textColor }]}>
                            Use Location for Matching
                        </Text>
                        <Switch
                            value={locationEnabled}
                            onValueChange={handleLocationToggle}
                            trackColor={{ false: '#D1D1D6', true: '#E1C4FF' }}
                            thumbColor={locationEnabled ? COLORS.static.primaryGradient[0] : '#f4f3f4'}
                        />
                    </View>
                    <Text style={[styles.description, { color: '#999' }]}>
                        Find musicians near you based on your location
                    </Text>
                </View>

                {/* Location Status */}
                {renderLocationStatus()}

                {/* Distance Slider */}
                {locationEnabled && (
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: textColor }]}>
                            Search Radius
                        </Text>
                        <Slider
                            style={styles.slider}
                            minimumValue={1}
                            maximumValue={150}
                            step={1}
                            value={distance}
                            onValueChange={setDistance}
                            minimumTrackTintColor={COLORS.static.primaryGradient[0]}
                            maximumTrackTintColor={isDark ? "#555" : "#EEEEEE"}
                            thumbTintColor={COLORS.static.primaryGradient[0]}
                        />
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>1 km</Text>
                            <Text style={[styles.sliderValue, { color: COLORS.static.primaryGradient[0] }]}>
                                {distance} km
                            </Text>
                            <Text style={styles.sliderLabel}>150 km</Text>
                        </View>
                        <Text style={[styles.description, { color: '#999' }]}>
                            Show musicians within this distance from your location
                        </Text>
                    </View>
                )}

                {/* Apply Button */}
                <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleApplySettings}
                >
                    <LinearGradient
                        colors={COLORS.static.primaryGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.applyButtonGradient}
                    >
                        <Text style={styles.applyButtonText}>Apply Settings</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modal: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
    },
    description: {
        fontSize: 14,
        lineHeight: 18,
    },
    locationStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        marginBottom: 20,
    },
    locationStatusText: {
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },
    retryButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#ff6b6b',
        borderRadius: 6,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    slider: {
        width: '100%',
        height: 40,
        marginBottom: 10,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sliderLabel: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
    },
    sliderValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    applyButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#ff6ec4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    applyButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default LocationSettingsModal;

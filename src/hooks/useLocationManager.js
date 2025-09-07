import { useState, useEffect, useCallback, useRef } from 'react';
import LocationService from '../services/LocationService';
import { useAuth } from '../context/AuthContext';

export const useLocationManager = () => {
    const { user } = useAuth();
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [locationError, setLocationError] = useState(null);

    // Add cleanup ref
    const cleanupRef = useRef(false);

    const updateLocation = useCallback(async (maxAgeHours = 6, forceUpdate = false) => {
        if (!user || cleanupRef.current) return; // Exit if cleaning up

        setLocationLoading(true);
        setLocationError(null);

        try {
            let locationResult;

            if (forceUpdate) {
                locationResult = await LocationService.getCurrentLocationWithAddress();
                if (locationResult.success && !cleanupRef.current) {
                    await LocationService.saveUserLocation(locationResult.address);
                    if (user.username) {
                        await LocationService.updateLocationOnBackend(locationResult.address, user.username);
                    }
                }
            } else {
                locationResult = await LocationService.smartLocationUpdate(user.username, maxAgeHours);
            }

            if (locationResult.success && !cleanupRef.current) {
                setCurrentLocation(locationResult.location);
            } else if (!cleanupRef.current) {
                setLocationError(locationResult.error || 'Failed to get location');
            }
        } catch (error) {
            if (!cleanupRef.current) {
                setLocationError(error.message);
            }
        } finally {
            if (!cleanupRef.current) {
                setLocationLoading(false);
            }
        }
    }, [user]);

    const getLocationForMatching = useCallback(async () => {
        if (!user || cleanupRef.current) return null;

        try {
            const locationResult = await LocationService.smartLocationUpdate(user.username, 2);

            if (locationResult.success && !cleanupRef.current) {
                setCurrentLocation(locationResult.location);
                return {
                    latitude: locationResult.location.latitude,
                    longitude: locationResult.location.longitude,
                    city: locationResult.location.city
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }, [user]);

    useEffect(() => {
        if (user && !cleanupRef.current) {
            updateLocation(6, false);
        }
    }, [user, updateLocation]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            cleanupRef.current = true;
            setLocationLoading(false);
            setLocationError(null);
            setCurrentLocation(null);
        };
    }, []);

    // Additional cleanup when user changes (sign out)
    useEffect(() => {
        if (!user) {
            cleanupRef.current = true;
            setCurrentLocation(null);
            setLocationError(null);
            setLocationLoading(false);
        } else {
            cleanupRef.current = false;
        }
    }, [user]);

    return {
        currentLocation,
        locationLoading,
        locationError,
        updateLocation,
        getLocationForMatching,
        isLocationFresh: useCallback((hours = 6) => LocationService.isLocationFresh(hours), []),
        forceLocationUpdate: useCallback(() => updateLocation(0, true), [updateLocation])
    };
};
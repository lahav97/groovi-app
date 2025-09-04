import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'aws-amplify';
import BackgroundDataService from '../services/BackgroundDataService';
import NotificationService from '../services/NotificationService';
import { saveUserEmail, clearUserEmail } from '../utils/userUtils';
import { getUsernameForChat } from '../services/profileService';
import { fetchUserProfile } from '../services/profileService';
import { createLogger } from '../utils/Logger';

const logger = createLogger('AuthContext');

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

    // Prevent duplicate background loading
    const backgroundLoadingTriggered = useRef(false);
    const lastLoadingEmail = useRef(null);

    // Initialize - check if user is already signed in
    useEffect(() => {
        checkAuthState();
    }, []);

    // FIXED: Restored fast auth check like the original, but with cache optimization
    const checkAuthState = async () => {
        console.log('🚀 AuthContext: Starting fast auth check...');

        try {
            // STEP 1: Try cache first for instant UI response (non-blocking)
            let cachedUserData = null;
            try {
                const cachedData = await AsyncStorage.getItem('userData');
                if (cachedData) {
                    cachedUserData = JSON.parse(cachedData);
                    console.log('⚡ AuthContext: Found cached user, setting UI state immediately');

                    // Set UI state immediately from cache for fast startup
                    setUser(cachedUserData);
                    setIsSignedIn(true);
                    setHasCompletedOnboarding(cachedUserData.hasCompletedOnboarding);
                }
            } catch (cacheError) {
                console.warn('Cache read failed:', cacheError.message);
            }

            // STEP 2: AWS verification (fast, no complex timeouts)
            const userInfo = await Auth.currentAuthenticatedUser();

            const onboardingCompleted = userInfo.attributes?.
                ['custom:onboardingCompleted'] === 'true';
            const userEmail = userInfo.attributes?.email || userInfo.username;

            console.log('✅ AuthContext: AWS verified user:', userEmail);
            console.log('🎯 AuthContext: Onboarding completed:', onboardingCompleted);

            const userData = {
                id: userInfo.attributes?.sub,
                username: userInfo.username,
                email: userEmail,
                phone: userInfo.attributes?.phone_number,
                hasCompletedOnboarding: onboardingCompleted
            };

            // Update state (might be same as cache, but ensures consistency)
            setUser(userData);
            setIsSignedIn(true);
            setHasCompletedOnboarding(onboardingCompleted);

            // Update cache
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            await saveUserEmail(userEmail);

            // FIXED: Start background tasks AFTER UI is ready (non-blocking)
            if (onboardingCompleted && userEmail &&
                (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userEmail)) {
                backgroundLoadingTriggered.current = true;
                lastLoadingEmail.current = userEmail;

                // Start background tasks without blocking UI
                setTimeout(() => {
                    console.log('🚀 AuthContext: Starting background tasks...');
                    Promise.all([
                        BackgroundDataService.startParallelLoading(userData),
                        initializeNotificationsBackground(userEmail)
                    ]).catch(error => {
                        console.warn('⚠️ Background tasks failed:', error);
                    });
                }, 100); // Minimal delay just to let UI render
            }

            console.log('✅ AuthContext: User restored from session');

        } catch (error) {
            console.log('ℹ️ AuthContext: No authenticated user found');
            setUser(null);
            setIsSignedIn(false);
            setHasCompletedOnboarding(false);
            await AsyncStorage.removeItem('userData');
            await clearUserEmail();

            // Reset background loading tracker
            backgroundLoadingTriggered.current = false;
            lastLoadingEmail.current = null;
        } finally {
            // CRITICAL: Always set loading to false immediately for fast UI
            setIsLoading(false);
        }
    };

    // Background notification initialization (non-blocking)
    const initializeNotificationsBackground = async (userEmail) => {
        try {
            const username = await getUsernameForChat(userEmail);
            if (username) {
                await NotificationService.initialize(username);
                console.log('✅ AuthContext: Notifications initialized in background');
            }
        } catch (error) {
            console.error('❌ AuthContext: Background notification init failed:', error);
        }
    };

    // Sign in
    const signIn = async (email, password) => {
        try {
            console.log('🔐 AuthContext: Signing in:', email);

            const userInfo = await Auth.signIn(email, password);
            const onboardingCompleted = userInfo.attributes?.
                ['custom:onboardingCompleted'] === 'true';
            const userEmail = userInfo.attributes?.email || email || userInfo.username;

            console.log('✅ AuthContext: Sign in successful');
            console.log('🎯 AuthContext: Onboarding completed:', onboardingCompleted);

            const userData = {
                id: userInfo.attributes?.sub || userInfo?.username,
                username: userInfo.username,
                email: userEmail,
                phone: userInfo.attributes?.phone_number,
                hasCompletedOnboarding: onboardingCompleted
            };

            setUser(userData);
            setIsSignedIn(true);
            setHasCompletedOnboarding(onboardingCompleted);

            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            await saveUserEmail(userEmail);

            // FIXED: Start background tasks after sign in (non-blocking)
            if (onboardingCompleted &&
                (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userEmail)) {
                backgroundLoadingTriggered.current = true;
                lastLoadingEmail.current = userEmail;

                // Non-blocking background initialization
                setTimeout(() => {
                    console.log('🚀 AuthContext: Starting background tasks after sign in');
                    Promise.all([
                        BackgroundDataService.startParallelLoading(userData),
                        initializeNotificationsBackground(userEmail)
                    ]).catch(error => {
                        console.warn('⚠️ Background tasks after sign in failed:', error);
                    });
                }, 200);
            }

            return {
                success: true,
                hasCompletedOnboarding: onboardingCompleted,
                userData
            };
        } catch (error) {
            console.error('❌ AuthContext: Sign in error:', error);
            return {
                success: false,
                error: error.message || 'Failed to sign in'
            };
        }
    };

    // Sign up with email, password, and other details
    const signUp = async (username, email, password, attributes = {}) => {
        setIsLoading(true);
        try {
            console.log('📝 AuthContext: Signing up:', email);

            const updatedAttributes = {
                ...attributes,
                'custom:onboardingCompleted': 'false'
            };

            const { user } = await Auth.signUp({
                username: email,
                password,
                attributes: {
                    email,
                    ...updatedAttributes
                }
            });

            console.log('✅ AuthContext: Sign up successful');

            return {
                success: true,
                user,
                needsConfirmation: true
            };
        } catch (error) {
            console.error('❌ AuthContext: Sign up error:', error);
            return {
                success: false,
                error: error.message || 'Failed to sign up'
            };
        } finally {
            setIsLoading(false);
        }
    };

    // Confirm sign up
    const confirmSignUp = async (username, code) => {
        try {
            console.log('✅ AuthContext: Confirming sign up for:', username);

            await Auth.confirmSignUp(username, code);
            console.log('✅ AuthContext: Sign up confirmed');

            return { success: true };
        } catch (error) {
            console.error('❌ AuthContext: Confirm sign up error:', error);
            return {
                success: false,
                error: error.message || 'Failed to confirm sign up'
            };
        }
    };

    // Check if user exists in Cognito
    const checkUserExistsInCognito = async (username) => {
        try {
            await Auth.forgotPassword(username);
            return { exists: true, error: null };
        } catch (error) {
            if (error.code === 'UserNotFoundException') {
                return { exists: false, error: null };
            }
            return { exists: false, error: error.message };
        }
    };

    // Complete onboarding
    const completeOnboarding = async () => {
        try {
            console.log('🎯 AuthContext: Completing onboarding...');

            if (!user) {
                throw new Error('No user found');
            }

            // Get the current Cognito user for updateUserAttributes
            const cognitoUser = await Auth.currentAuthenticatedUser();

            await Auth.updateUserAttributes(cognitoUser, {
                'custom:onboardingCompleted': 'true'
            });

            const updatedUser = { ...user, hasCompletedOnboarding: true };
            setUser(updatedUser);
            setHasCompletedOnboarding(true);
            await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

            // FIXED: Start background tasks after onboarding (non-blocking)
            if (!backgroundLoadingTriggered.current) {
                backgroundLoadingTriggered.current = true;
                lastLoadingEmail.current = updatedUser.email;

                setTimeout(() => {
                    console.log('🚀 AuthContext: Starting background tasks after onboarding');
                    Promise.all([
                        BackgroundDataService.startParallelLoading(updatedUser),
                        initializeNotificationsBackground(updatedUser.email)
                    ]).catch(error => {
                        console.warn('⚠️ Background tasks after onboarding failed:', error);
                    });
                }, 300);
            }

            console.log('✅ AuthContext: Onboarding completed');
            return { success: true };
        } catch (error) {
            console.error('❌ AuthContext: Error completing onboarding:', error);
            return {
                success: false,
                error: error.message || 'Failed to mark onboarding as complete'
            };
        }
    };

    // Resend confirmation code - NO GLOBAL LOADING STATE CHANGES
    const resendConfirmationCode = async (username) => {
        try {
            await Auth.resendSignUp(username);
            console.log('✅ AuthContext: Confirmation code resent');

            return { success: true };
        } catch (error) {
            console.error('❌ AuthContext: Resend confirmation error:', error);
            return {
                success: false,
                error: error.message || 'Failed to resend confirmation code'
            };
        }
    };

    // Sign out with cleanup
    const signOut = async () => {
        setIsLoading(true);
        try {
            console.log('🚪 AuthContext: Signing out...');

            await Auth.signOut();

            // Clear state and storage
            setUser(null);
            setIsSignedIn(false);
            setHasCompletedOnboarding(false);
            await AsyncStorage.removeItem('userData');
            await clearUserEmail();

            // Reset background loading tracker
            backgroundLoadingTriggered.current = false;
            lastLoadingEmail.current = null;

            console.log('✅ AuthContext: Signed out successfully');

            return { success: true };
        } catch (error) {
            console.error('❌ AuthContext: Sign out error:', error);
            return {
                success: false,
                error: error.message || 'Failed to sign out'
            };
        } finally {
            setIsLoading(false);
        }
    };

    // Social sign in
    const federatedSignIn = async (provider, token, userData) => {
        setIsLoading(true);
        try {
            console.log('🔗 AuthContext: Federated sign in:', provider);

            setUser(userData);
            setIsSignedIn(true);
            await AsyncStorage.setItem('userData', JSON.stringify(userData));
            await saveUserEmail(userData.email);

            // FIXED: Start background tasks for social sign in (non-blocking)
            if (userData.email &&
                (!backgroundLoadingTriggered.current || lastLoadingEmail.current !== userData.email)) {
                backgroundLoadingTriggered.current = true;
                lastLoadingEmail.current = userData.email;

                setTimeout(() => {
                    console.log('🚀 AuthContext: Starting background tasks after social sign in');
                    Promise.all([
                        BackgroundDataService.startParallelLoading(userData),
                        initializeNotificationsBackground(userData.email)
                    ]).catch(error => {
                        console.warn('⚠️ Background tasks after social sign in failed:', error);
                    });
                }, 200);
            }

            return { success: true };
        } catch (error) {
            console.error('❌ AuthContext: Federated sign in error:', error);
            return {
                success: false,
                error: error.message || 'Failed to sign in'
            };
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh user without duplicate loading
    const refreshUser = async () => {
        const wasTriggered = backgroundLoadingTriggered.current;
        const lastEmail = lastLoadingEmail.current;

        await checkAuthState();

        // Restore previous state to prevent duplicate loading
        backgroundLoadingTriggered.current = wasTriggered;
        lastLoadingEmail.current = lastEmail;
    };

    // Refresh user profile data from the server
    const refreshUserProfile = async () => {
        try {
            if (!user) {
                logger.warn('⚠️ No user found for profile refresh');
                return { success: false, error: 'No user found' };
            }

            logger.info('🔄 Refreshing user profile data');

            // Fetch fresh profile data using username (most reliable identifier)
            const profileResult = await fetchUserProfile('username', user.username);

            if (profileResult && profileResult.success && profileResult.profile) {
                logger.info('✅ Profile refreshed successfully', {
                    username: profileResult.profile.username,
                    videosCount: profileResult.profile.videos?.length || 0
                });

                // Update the user context with fresh profile data
                const updatedUser = {
                    ...user,
                    ...profileResult.profile,
                    // Preserve auth-specific fields
                    id: user.id,
                    hasCompletedOnboarding: user.hasCompletedOnboarding
                };

                setUser(updatedUser);
                await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

                return { success: true, profile: profileResult.profile };
            } else {
                logger.warn('⚠️ Profile refresh returned no data');
                return { success: false, error: 'No profile data returned' };
            }
        } catch (error) {
            logger.error('❌ Failed to refresh user profile', { error: error.message });
            return { success: false, error: error.message };
        }
    };

    // Get background loading status
    const getBackgroundLoadingStatus = () => {
        return BackgroundDataService.getLoadingStatus();
    };

    // Force refresh all background data
    const forceRefreshAllData = async () => {
        console.log('🔄 AuthContext: Force refreshing all data...');
        await BackgroundDataService.forceRefreshAll();
    };

    return (
        <AuthContext.Provider
            value={{
                // State
                user,
                isLoading,
                isSignedIn,
                hasCompletedOnboarding,

                // Auth methods
                signIn,
                signUp,
                confirmSignUp,
                signOut,
                federatedSignIn,

                // Utility methods
                refreshUser,
                resendConfirmationCode,
                checkUserExistsInCognito,
                completeOnboarding,
                refreshUserProfile,

                // Background loading methods
                getBackgroundLoadingStatus,
                forceRefreshAllData
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);


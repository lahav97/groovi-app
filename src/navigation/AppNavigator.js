import React, { useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // RESTORED
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, LogBox } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from '../screens/authentication/LoginScreen';
import DiscoverScreen from '../screens/feed/DiscoverScreen';
import LoginWithEmailScreen from '../screens/authentication/LoginWithEmailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SignupNavigator from './SignupNavigator';
import FilterScreen from '../screens/feed/FilterScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import { SignupFlowProvider } from '../context/SignupFlowContext';
import InstrumentsScreen from '../screens/onboarding/InstrumentsScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import VideoUploadScreen from '../screens/feed/VideoUploadScreen';
import MatchScreen from '../screens/feed/MatchScreen';
import SearchScreen from '../screens/feed/SearchScreen';
import MusicianProfileScreen from '../screens/profile/MusicianProfileScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import TopBar from '../components/navigationBar/TopNavigation';

// Memory management utilities
import AppMemoryManager from '../utils/AppMemoryManager';
import { clearVideoCache } from '../hooks/useVideoCache';
import { useHeavyMemoryCleanup, useLightMemoryCleanup } from '../hooks/useMemoryCleanup';
import BackgroundDataService from '../services/BackgroundDataService';

// Navigation service for programmatic navigation
import NavigationService, { navigationRef } from '../services/NavigationService';

// Ignore specific harmless warnings
LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
]);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); // RESTORED

/**
 * Higher-order component to wrap screens with appropriate memory cleanup
 */
function withMemoryCleanup(Component, screenName, isHeavy = true) {
    return function Wrapper(props) {
        const cleanup = isHeavy
            ? useHeavyMemoryCleanup(screenName)
            : useLightMemoryCleanup(screenName);

        return <Component {...props} />;
    };
}

// Auth stack
const AuthStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="LoginWithEmail" component={LoginWithEmailScreen} />
        <Stack.Screen
            name="SignupFlow"
            component={SignupNavigator}
            options={{ headerShown: false }}
        />
    </Stack.Navigator>
);

// Onboarding stack
const OnboardingStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Instruments" component={InstrumentsScreen} />
        <Stack.Screen name="Profile Setup" component={ProfileSetupScreen} />
    </Stack.Navigator>
);

// FIXED: Restored proper Tab Navigator
const MainTabs = () => {
    useEffect(() => {
        AppMemoryManager.init?.();
        console.log('MainTabs mounted - AppMemoryManager initialized');

        return () => {
            console.log('MainTabs unmounted - performing final cleanup');
            AppMemoryManager.clearAll?.();
            BackgroundDataService.cancelAllRequests?.();
        };
    }, []);

    return (
        <Tab.Navigator
            screenOptions={() => ({
                headerShown: false,
                tabBarStyle: { display: 'none' }, // Hide built-in tab bar, use custom
                unmountOnBlur: true, // CRITICAL: Restored for memory management
            })}
        >
            <Tab.Screen
                name="Discover"
                component={withMemoryCleanup(DiscoverScreen, 'DiscoverScreen', true)}
                options={{
                    unmountOnBlur: true,
                    tabBarLabel: 'Discover'
                }}
            />
            <Tab.Screen
                name="Match"
                component={withMemoryCleanup(MatchScreen, 'MatchScreen', true)}
                options={{
                    unmountOnBlur: true,
                    tabBarLabel: 'Match'
                }}
            />
            <Tab.Screen
                name="ChatList"
                component={withMemoryCleanup(ChatListScreen, 'ChatListScreen', false)}
                options={{
                    tabBarLabel: 'Chats'
                }}
            />
            <Tab.Screen
                name="Profile"
                component={withMemoryCleanup(ProfileScreen, 'ProfileScreen', true)}
                options={{
                    unmountOnBlur: true,
                    tabBarLabel: 'Profile'
                }}
            />
        </Tab.Navigator>
    );
};

// FIXED: Separate stack for modals over the tabs
const MainStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Filter" component={FilterScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="MusicianProfile" component={MusicianProfileScreen} />
        <Stack.Screen name="ChatScreen" component={ChatScreen} />
    </Stack.Navigator>
);

const AppLoadingScreen = () => (
    <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    }}>
        <ActivityIndicator size="large" color="#ff6ec4" />
    </View>
);

const AppNavigator = () => {
    const { isSignedIn, isLoading, hasCompletedOnboarding } = useAuth();

    // Enhanced memory management on navigation state changes
    useEffect(() => {
        console.log('Auth state changed. isSignedIn:', isSignedIn, 'hasCompletedOnboarding:', hasCompletedOnboarding);

        if (isSignedIn !== undefined) {
            AppMemoryManager.clearAll?.();
            BackgroundDataService.cancelAllRequests?.();
        }
    }, [isSignedIn, hasCompletedOnboarding]);

    // Global memory management setup
    useEffect(() => {
        console.log('AppNavigator mounted - setting up global memory management');

        AppMemoryManager.init?.();

        const navigationListener = (reason) => {
            console.log(`Navigation cleanup triggered: ${reason}`);
        };

        AppMemoryManager.addNavigationListener?.(navigationListener);

        return () => {
            console.log('AppNavigator unmounted - final cleanup');
            AppMemoryManager.removeNavigationListener?.(navigationListener);
            AppMemoryManager.clearAll?.();
            BackgroundDataService.cancelAllRequests?.();

            if (global.gc) {
                setTimeout(() => global.gc(), 100);
            }
        };
    }, []);

    if (isLoading) {
        return (
            <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                    NavigationService.setReady();
                }}
            >
                <SignupFlowProvider>
                    <AppLoadingScreen />
                </SignupFlowProvider>
            </NavigationContainer>
        );
    }

    return (
        <NavigationContainer
            ref={navigationRef}
            onReady={() => {
                NavigationService.setReady();
            }}
            onStateChange={(state) => {
                if (state) {
                    const getCurrentRouteName = (navigationState) => {
                        if (!navigationState || !navigationState.routes) return 'Unknown';

                        const route = navigationState.routes[navigationState.index];
                        if (route.state) {
                            return getCurrentRouteName(route.state);
                        }
                        return route.name;
                    };

                    const currentRouteName = getCurrentRouteName(state);
                    console.log('Navigation changed to:', currentRouteName);

                    if (currentRouteName) {
                        AppMemoryManager.handleNavigationChange?.(currentRouteName);
                    }
                }
            }}
        >
            <SignupFlowProvider>
                {!isSignedIn ? (
                    <AuthStack />
                ) : !hasCompletedOnboarding ? (
                    <OnboardingStack />
                ) : (
                    <MainStack />
                )}
            </SignupFlowProvider>
        </NavigationContainer>
    );
};

export default AppNavigator;
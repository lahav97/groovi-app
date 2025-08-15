import React, { useEffect, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

// Memory management utilities
import AppMemoryManager from '../utils/AppMemoryManager';
import { clearVideoCache } from '../hooks/useVideoCache';
import { useHeavyMemoryCleanup, useLightMemoryCleanup } from '../hooks/useMemoryCleanup';
import BackgroundDataService from '../services/BackgroundDataService';

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Higher-order component to wrap screens with appropriate memory cleanup
 */
function withMemoryCleanup(Component, screenName, isHeavy = true) {
  return function Wrapper(props) {
    // Use appropriate cleanup hook based on screen type
    const cleanup = isHeavy 
      ? useHeavyMemoryCleanup(screenName)
      : useLightMemoryCleanup(screenName);

    return <Component {...props} />;
  };
}

// Separate navigators for better organization
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

// This navigator handles the onboarding flow
const OnboardingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Instruments" component={InstrumentsScreen} />
    <Stack.Screen name="Profile Setup" component={ProfileSetupScreen} />
  </Stack.Navigator>
);

// Main tab navigator with memory management
const MainTabs = () => {
  useEffect(() => {
    // Initialize AppMemoryManager
    AppMemoryManager.init?.();
    console.log('✅ MainTabs mounted - AppMemoryManager initialized');

    return () => {
      console.log('♻️ MainTabs unmounted - performing final cleanup');
      AppMemoryManager.clearAll?.();
      BackgroundDataService.cancelAllRequests?.();
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={() => ({
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hide the built-in tab bar
        // Critical: Unmount screens when not focused to free memory
        unmountOnBlur: true,
      })}
    >
      {/* Wrap heavy video screens with cleanup logic */}
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
      {/* Chat screen is lightweight */}
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

// Stack navigator for modal and nested screens
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

const AppNavigator = () => {
  const { isSignedIn, isLoading, hasCompletedOnboarding } = useAuth();

  // Enhanced memory management on navigation state changes
  useEffect(() => {
    console.log('Auth state changed. isSignedIn:', isSignedIn, 'hasCompletedOnboarding:', hasCompletedOnboarding);
    
    // Clean up memory when auth state changes
    if (isSignedIn !== undefined) {
      AppMemoryManager.clearAll?.();
      BackgroundDataService.cancelAllRequests?.();
    }
  }, [isSignedIn, hasCompletedOnboarding]);

  // Global memory management setup
  useEffect(() => {
    console.log('✅ AppNavigator mounted - setting up global memory management');

    // Initialize memory manager
    AppMemoryManager.init?.();

    // Set up navigation change listener for memory cleanup
    const navigationListener = (reason) => {
      console.log(`🔄 Navigation cleanup triggered: ${reason}`);
      // This will be called by AppMemoryManager when navigation occurs
    };

    AppMemoryManager.addNavigationListener?.(navigationListener);

    return () => {
      console.log('♻️ AppNavigator unmounted - final cleanup');
      AppMemoryManager.removeNavigationListener?.(navigationListener);
      AppMemoryManager.clearAll?.();
      BackgroundDataService.cancelAllRequests?.();
      
      // Force final garbage collection
      if (global.gc) {
        setTimeout(() => global.gc(), 100);
      }
    };
  }, []);

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#000'
      }}>
        <ActivityIndicator size="large" color="#ff6ec4" />
      </View>
    );
  }

  return (
    <NavigationContainer
      onStateChange={(state) => {
        if (state) {
          // Get current route name
          const getCurrentRouteName = (navigationState) => {
            if (!navigationState || !navigationState.routes) return 'Unknown';
            
            const route = navigationState.routes[navigationState.index];
            if (route.state) {
              return getCurrentRouteName(route.state);
            }
            return route.name;
          };

          const currentRouteName = getCurrentRouteName(state);
          
          // Trigger navigation cleanup through AppMemoryManager
          AppMemoryManager.onNavigationChange?.('previousRoute', currentRouteName);
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
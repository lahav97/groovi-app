import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, LogBox } from 'react-native';
import LoginScreen from '../screens/authentication/LoginScreen';
import FeedScreen from '../screens/main/FeedScreen';
import LoginWithEmailScreen from '../screens/authentication/LoginWithEmailScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import SignupNavigator from './SignupNavigator';
import FilterScreen from '../screens/main/FilterScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import { SignupFlowProvider } from '../context/SignupFlowContext';
import InstrumentsScreen from '../screens/onboarding/InstrumentsScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';

// Ignore specific harmless warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const Stack = createNativeStackNavigator();

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

// Main app screens
const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Feed" component={FeedScreen} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="Filter" component={FilterScreen} /> 
    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
  </Stack.Navigator>
);

const AppNavigator = () => {
  const { isSignedIn, isLoading, hasCompletedOnboarding } = useAuth();

  // Log navigation state changes for debugging
  useEffect(() => {
    console.log('Auth state changed. isSignedIn:', isSignedIn, 'hasCompletedOnboarding:', hasCompletedOnboarding);
  }, [isSignedIn, hasCompletedOnboarding]);

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
    <NavigationContainer>
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
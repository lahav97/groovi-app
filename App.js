import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Amplify } from 'aws-amplify';
import { AuthProvider } from './src/context/AuthContext';
import { LogBox, StyleSheet, AppState } from 'react-native';
import { manageCacheSize } from './src/utils/cacheManager';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import awsConfig from './src/utils/awsConfig';
import AppNavigator from './src/navigation/AppNavigator';
import React, { useEffect } from 'react';

Amplify.configure(awsConfig);

LogBox.ignoreLogs([
  'Support for defaultProps will be removed from function components',
]);

export default function App() {
  useEffect(() => {
    const initializeCache = async () => {
      try {
        await manageCacheSize(200);
        console.log('Initial cache management completed');
      } catch (error) {
        console.error('Error in initial cache management:', error);
      }
    };
    
    initializeCache();
    
    // Set up AppState listener for background cleanup
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        console.log('App going to background, cleaning cache...');
        manageCacheSize(200).catch(err => 
          console.error('Error cleaning cache in background:', err)
        );
      }
    });

    // Clean up listener on component unmount
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
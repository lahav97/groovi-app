import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Amplify } from 'aws-amplify';
import { AuthProvider } from './src/context/AuthContext';
import { LogBox, StyleSheet, AppState, View, ActivityIndicator } from 'react-native';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import awsConfig from './src/utils/awsConfig';
import AppNavigator from './src/navigation/AppNavigator';
import React, { useEffect, useRef, useState } from 'react';
import { SignupFlowProvider } from './src/context/SignupFlowContext';
import { FiltersProvider } from './src/context/FiltersContext';
import AppMemoryManager from './src/utils/AppMemoryManager';
import NotificationService from './src/services/NotificationService';

Amplify.configure(awsConfig);

LogBox.ignoreLogs([
    'Support for defaultProps will be removed from function components',
]);

// Minimal loading screen component that shows immediately
const InitialLoadingScreen = () => (
    <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    }}>
        <ActivityIndicator size="large" color="#ff6ec4" />
    </View>
);

export default function App() {
    const appState = useRef(AppState.currentState);
    const [isAppReady, setIsAppReady] = useState(false);

    useEffect(() => {
        // Quick app initialization without blocking UI
        const initializeApp = async () => {
            try {
                // Initialize memory manager (non-blocking)
                AppMemoryManager.init();
                console.log('✅ App initialized with memory management');

                // Mark app as ready immediately to show loading screens
                setIsAppReady(true);
            } catch (error) {
                console.error('❌ App initialization error:', error);
                // Still mark as ready to show error handling in AuthContext
                setIsAppReady(true);
            }
        };

        initializeApp();

        // Set up app state change listener for notification handling
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App has come to the foreground - check for notification navigation
                NotificationService.handleAppStateChange(nextAppState);
            }
            appState.current = nextAppState;
        });

        return () => {
            // Cleanup on app shutdown
            AppMemoryManager.shutdown();
            subscription?.remove();
            console.log('✅ App shutdown cleanup complete');
        };
    }, []);

    // Show minimal loading only during app bootstrap
    if (!isAppReady) {
        return <InitialLoadingScreen />;
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                <SignupFlowProvider>
                    <AuthProvider>
                        <FiltersProvider>
                            <AppNavigator />
                        </FiltersProvider>
                    </AuthProvider>
                </SignupFlowProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
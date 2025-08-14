import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Amplify } from 'aws-amplify';
import { AuthProvider } from './src/context/AuthContext';
import { LogBox, StyleSheet } from 'react-native';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import awsConfig from './src/utils/awsConfig';
import AppNavigator from './src/navigation/AppNavigator';
import React, { useEffect } from 'react';
import { SignupFlowProvider } from './src/context/SignupFlowContext';
import { FiltersProvider } from './src/context/FiltersContext';
import AppMemoryManager from './src/utils/AppMemoryManager';

Amplify.configure(awsConfig);

LogBox.ignoreLogs([
    'Support for defaultProps will be removed from function components',
]);

export default function App() {
    // REMOVE the old cache management useEffect and KEEP only this one
    useEffect(() => {
        // Initialize memory manager (handles everything)
        AppMemoryManager.init();
        console.log('✅ App initialized with memory management');
        
        return () => {
            // Cleanup on app shutdown
            AppMemoryManager.shutdown();
            console.log('✅ App shutdown cleanup complete');
        };
    }, []);

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
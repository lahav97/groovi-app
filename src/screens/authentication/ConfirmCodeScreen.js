/**
 * @module ConfirmCodeScreen
 * Screen for confirming a user's signup by entering a verification code.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useSignupBuilder } from '../../context/SignupFlowContext';

/**
 * @function ConfirmCodeScreen
 * @description Handles the verification code input and confirmation process for signing up a user.
 * @returns {JSX.Element} The confirmation screen component.
 */
const ConfirmCodeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { username, password } = route.params || {};
  const [code, setCode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState(null); // 'success', 'error', 'info'
  
  // Use the auth context and signup builder
  const { confirmSignUp, resendConfirmationCode, signIn, isSignedIn } = useAuth();
  const signupBuilder = useSignupBuilder();
  
  // Store credentials in the builder for later use in ProfileSetupScreen
  useEffect(() => {
    if (username && password) {
      // Make sure these methods exist in your builder
      if (signupBuilder.setUsername && signupBuilder.setPassword) {
        signupBuilder.setUsername(username);
        signupBuilder.setPassword(password);
      }
    }
  }, [username, password, signupBuilder]);

  // Watch for sign-in state changes and redirect if needed
  useEffect(() => {
    if (isSignedIn) {
      console.log('User is signed in, navigation should be handled by AppNavigator');
      // No need to do anything - AppNavigator will show the authenticated routes
    }
  }, [isSignedIn, navigation]);

  // Clear status message after a delay
  useEffect(() => {
    let timer;
    if (statusMessage) {
      timer = setTimeout(() => {
        setStatusMessage(null);
        setStatusType(null);
      }, 3000); // Clear after 3 seconds
    }
    return () => clearTimeout(timer);
  }, [statusMessage]);

  /**
   * @function handleConfirm
   * @description Confirms the sign-up using the verification code and signs in the user.
   */
  const handleConfirm = async () => {
    if (!code.trim()) {
      setStatusMessage('Please enter the verification code');
      setStatusType('error');
      return;
    }

    setIsConfirming(true);
    try {
      // Only confirm the signup without signing in
      console.log(`Confirming signup for user: ${username} with code: ${code}`);
      const confirmResult = await confirmSignUp(username, code);
      
      if (!confirmResult.success) {
        console.log('❌ Confirmation failed:', confirmResult.error);
        setStatusMessage(confirmResult.error || 'Failed to confirm your account');
        setStatusType('error');
        setIsConfirming(false);
        return;
      }
      
      console.log('✅ Account confirmed successfully!');
      setStatusMessage('Account confirmed successfully!');
      setStatusType('success');
      
      // Try to sign in the user automatically - this will change isSignedIn state
      // which will cause AppNavigator to render the authenticated routes
      await signIn(username, password);
      
      // No need to navigate manually - the AppNavigator will handle it based on isSignedIn
      
    } catch (error) {
      console.error('❌ Error in confirmation process:', error);
      setStatusMessage(error.message || 'Failed to complete the confirmation process');
      setStatusType('error');
    } finally {
      setIsConfirming(false);
    }
  };

  /**
   * @function handleResendCode
   * @description Resends the confirmation code to the user.
   */
  const handleResendCode = async () => {
    setIsResending(true);
    try {
      // Use the method from AuthContext
      const result = await resendConfirmationCode(username);
      
      if (result.success) {
        console.log('✅ Verification code resent successfully');
        setStatusMessage('Verification code resent');
        setStatusType('success');
      } else {
        console.log('❌ Failed to resend code:', result.error);
        setStatusMessage(result.error || 'Failed to resend verification code');
        setStatusType('error');
      }
    } catch (error) {
      console.error('❌ Error resending code:', error);
      setStatusMessage(error.message || 'Failed to resend code');
      setStatusType('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter your verification code</Text>
        
        {statusMessage && (
          <View style={[
            styles.statusContainer, 
            statusType === 'success' && styles.successStatus,
            statusType === 'error' && styles.errorStatus,
            statusType === 'info' && styles.infoStatus,
          ]}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Verification code"
          keyboardType="number-pad"
          onChangeText={setCode}
          value={code}
          placeholderTextColor="#666"
          editable={!isConfirming && !isResending}
        />

        <Button
          title={isConfirming ? "CONFIRMING..." : "CONFIRM"}
          onPress={handleConfirm}
          style={styles.confirmButton}
          textStyle={styles.confirmText}
          disabled={isConfirming || isResending || !code.trim()}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive a code?</Text>
          <Button
            title={isResending ? "SENDING..." : "RESEND CODE"}
            onPress={handleResendCode}
            style={styles.resendButton}
            textStyle={styles.resendButtonText}
            disabled={isConfirming || isResending}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingTop: 140, paddingHorizontal: 30, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white', marginBottom: 30 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    width: '100%',
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  resendContainer: { alignItems: 'center' },
  resendText: { color: 'white', fontSize: 14, marginBottom: 8 },
  resendButton: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  resendButtonText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
  // Status message styles
  statusContainer: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  successStatus: {
    backgroundColor: 'rgba(39, 174, 96, 0.8)',
  },
  errorStatus: {
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
  },
  infoStatus: {
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ConfirmCodeScreen;
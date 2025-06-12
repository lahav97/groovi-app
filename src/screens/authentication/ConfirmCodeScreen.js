/**
 * @module ConfirmCodeScreen
 * Screen for confirming a user's signup by entering a verification code.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../styles/theme';
import {
  ERROR_MESSAGES,
  handleError
} from '../../utils/errors';

/**
 * @function ConfirmCodeScreen
 * @description Handles the verification code input and confirmation process for signing up a user.
 * @returns {JSX.Element} The confirmation screen component.
 */
const ConfirmCodeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = route.params || {};
  const username = user?.username;
  const password = user?.password;

  // Single state object for better performance
  const [state, setState] = useState({
    code: '',
    isConfirming: false,
    isResending: false,
    statusMessage: null,
    statusType: null, // 'success', 'error', 'info'
  });

  // Use ref to prevent rebuilding user multiple times
  const hasBuiltUser = useRef(false);
  const statusTimer = useRef(null);

  // Auth context and signup builder
  const { confirmSignUp, resendConfirmationCode, signIn } = useAuth();
  const signupBuilder = useSignupBuilder();

  // Memoized user building - only when dependencies change
  const buildUserIntoBuilder = useCallback(() => {
    if (user && signupBuilder && !hasBuiltUser.current) {
      signupBuilder
        .setUsername(user.username)
        .setPassword(user.password)
        .setFullName(user.fullName)
        .setEmail(user.email)
        .setUserType(user.userType)
        .setGender(user.gender)
        .setPhoneNumber(user.phoneNumber)
        .setBirthDate(user.birthDate);

      hasBuiltUser.current = true;
    }
  }, [user, signupBuilder]);

  // Build user on mount - but optimized
  useEffect(() => {
    buildUserIntoBuilder();
  }, [buildUserIntoBuilder]);

  // Optimized status message handler
  const setStatusMessage = useCallback((message, type) => {
    setState(prev => ({
      ...prev,
      statusMessage: message,
      statusType: type
    }));

    // Clear existing timer
    if (statusTimer.current) {
      clearTimeout(statusTimer.current);
    }

    // Set new timer
    if (message) {
      statusTimer.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          statusMessage: null,
          statusType: null
        }));
      }, 3000);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (statusTimer.current) {
        clearTimeout(statusTimer.current);
      }
    };
  }, []);

  /**
   * @function handleConfirm
   * @description Confirms the sign-up using the verification code and signs in the user.
   */
  const handleConfirm = useCallback(async () => {
    if (!username) {
      setStatusMessage(ERROR_MESSAGES.AUTH.MISSING_USERNAME || 'Something went wrong. Missing username.', 'error');
      return;
    }
    
    if (!state.code.trim()) {
      setStatusMessage(ERROR_MESSAGES.VALIDATION.CODE_REQUIRED || 'Please enter the verification code', 'error');
      return;
    }

    setState(prev => ({ ...prev, isConfirming: true }));

    try {
      // First, confirm the signup
      const confirmResult = await confirmSignUp(username, state.code);
      
      if (!confirmResult.success) {
        console.log('❌ Confirmation failed:', confirmResult.error);
        setStatusMessage(handleError(confirmResult.error, 'ConfirmCodeScreen/handleConfirm'), 'error');
        return;
      }
      
      console.log('✅ Account confirmed successfully!');
      setStatusMessage('Account confirmed successfully!', 'success');
      
      // Sign in the user
      const signInResult = await signIn(username, password);
      
      if (signInResult.success) {
        const { userData } = signInResult;
      
        // Update builder with sign-in data
        signupBuilder
          .setUsername(userData.username)
          .setEmail(userData.email)
          .setFullName(user?.fullName || userData.username)
          .setPassword(password)
          .setUserType(user?.userType || 'musician')
          .setGender(user?.gender)
          .setBirthDate(user?.birthDate)
          .setPhoneNumber(user?.phoneNumber || null);
      
        const builtUser = signupBuilder.build();
      
        AsyncStorage.setItem('signupBuilderBackup', JSON.stringify(builtUser))
          .catch(err => console.error('Error saving backup:', err));        
      } else {
        // Failed to sign in automatically
        setStatusMessage('Account confirmed, but failed to sign in automatically. Please log in.', 'error');
        setTimeout(() => {
          navigation.navigate('LoginWithEmail');
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error in confirmation process:', error);
      setStatusMessage(handleError(error, 'ConfirmCodeScreen/handleConfirm'), 'error');
    } finally {
      setState(prev => ({ ...prev, isConfirming: false }));
    }
  }, [username, state.code, password, confirmSignUp, signIn, signupBuilder, user, setStatusMessage, navigation]);

  /**
   * @function handleResendCode
   * @description Resends the confirmation code to the user.
   */
  const handleResendCode = useCallback(async () => {
    setState(prev => ({ ...prev, isResending: true }));
    
    try {
      const result = await resendConfirmationCode(username);
      
      if (result.success) {
        console.log('✅ Verification code resent successfully');
        setStatusMessage('Verification code resent', 'success');
      } else {
        console.log('❌ Failed to resend code:', result.error);
        setStatusMessage(handleError(result.error, 'ConfirmCodeScreen/handleResendCode'), 'error');
      }
    } catch (error) {
      console.error('❌ Error resending code:', error);
      setStatusMessage(error.message || 'Failed to resend code', 'error');
    } finally {
      setState(prev => ({ ...prev, isResending: false }));
    }
  }, [username, resendConfirmationCode, setStatusMessage]);

  const handleCodeChange = useCallback((text) => {
    setState(prev => ({ ...prev, code: text }));
  }, []);

  const isButtonDisabled = state.isConfirming || state.isResending || !state.code.trim();

  return (
    <LinearGradient
      colors={COLORS.static.primaryGradient}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Enter your verification code</Text>
        
        {state.statusMessage && (
          <View style={[
            styles.statusContainer, 
            state.statusType === 'success' && styles.successStatus,
            state.statusType === 'error' && styles.errorStatus,
            state.statusType === 'info' && styles.infoStatus,
          ]}>
            <Text style={styles.statusText}>{state.statusMessage}</Text>
          </View>
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Verification code"
          keyboardType="number-pad"
          onChangeText={handleCodeChange}
          value={state.code}
          placeholderTextColor="#666"
          editable={!state.isConfirming && !state.isResending}
        />

        <Button
          title={state.isConfirming ? "CONFIRMING..." : "CONFIRM"}
          onPress={handleConfirm}
          style={styles.confirmButton}
          textStyle={styles.confirmText}
          disabled={isButtonDisabled}
        >
          {state.isConfirming ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.confirmText}>CONFIRM</Text>
          )}
        </Button>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive a code?</Text>
          <Button
            title={state.isResending ? "SENDING..." : "RESEND CODE"}
            onPress={handleResendCode}
            style={styles.resendButton}
            textStyle={styles.resendButtonText}
            disabled={state.isConfirming || state.isResending}
          >
            {state.isResending ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.resendButtonText}>RESEND CODE</Text>
            )}
          </Button>
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
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { saveUserEmail } from '../../utils/userUtils';
import { COLORS } from '../../styles/theme';

const LoginWithEmailScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigation = useNavigation();
  
  // Use the auth context
  const { signIn, refreshUser } = useAuth();

  /**
   * @function validateForm
   * @description Validates email and password formats
   * @returns {boolean} True if inputs are valid
   */
  const validateForm = () => {
    // Clear any previous errors
    setAuthError('');
    
    // Validate password
    if (!password) {
      setAuthError('Please enter a password');
      return false;
    }

    // Validate email format
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      setAuthError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };

/**
 * @function handleContinue
 * @description Validates user input, checks if user exists, and signs in if valid.
 */
const handleContinue = async () => {
  if (!validateForm()) {
    return;
  }
  
  setIsLoading(true); 
  
  try {
    // User exists, proceed with sign in
    console.log('📧 Email is valid, attempting sign in:', email);
    
    const result = await signIn(email, password);

    if (result.success) {
      console.log('Sign in successful, userData:', result.userData);
      console.log('Onboarding completed:', result.hasCompletedOnboarding);
      
      // Save the email to AsyncStorage for later use
      await saveUserEmail(email);
      console.log('Email saved to AsyncStorage:', email);
    } else {
      console.log('❌ Sign in failed:', result.error);
      setAuthError(result.error || 'Failed to sign in. Please try again.');
    }
  } catch (error) {
    console.error('Error signing in with email:', error);
    
    if (error.code === 'UserNotFoundException') {
      setAuthError('Account not found. Please check your email.');
    } else if (error.code === 'NotAuthorizedException') {
      setAuthError('Incorrect password. Please try again.');
    } else {
      setAuthError(error.message || 'Failed to sign in. Please try again.');
    }
  } finally {
    setIsLoading(false);
  }
};

  return (
    <LinearGradient
      colors={COLORS.static.primaryGradient} 
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
        disabled={isLoading}
      >
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>Log In</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            placeholderTextColor="#666"
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeIcon}
            disabled={isLoading}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {authError !== '' && (
          <Text style={styles.errorText}>{authError}</Text>
        )}

        <Button
          title={isLoading ? "Signing in..." : "Continue"}
          onPress={handleContinue}
          style={styles.continueButton}
          textStyle={styles.continueText}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.continueText}>Continue</Text>
          )}
        </Button>
        
        <TouchableOpacity 
          style={styles.signupLink}
          onPress={() => navigation.navigate('SignupFlow')}
          disabled={isLoading}
        >
          <Text style={styles.signupText}>Don't have an account? Sign up</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

// Styles remain unchanged
const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { paddingTop: 160, paddingHorizontal: 30 },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  title: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    marginBottom: 40,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#000',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
    width: '100%',
    alignSelf: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 12,
    marginLeft: 5,
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  continueButton: {
    backgroundColor: 'white',
    paddingVertical: 18,
    borderRadius: 40,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
    alignSelf: 'center',
  },
  continueText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
  eyeIcon: {
    position: 'absolute',
    right: 20,
    top: 0,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupLink: {
    marginTop: 20,
    alignSelf: 'center',
  },
  signupText: {
    color: 'white',
    fontSize: 16,
    textDecorationLine: 'underline',
  }
});

export default LoginWithEmailScreen;
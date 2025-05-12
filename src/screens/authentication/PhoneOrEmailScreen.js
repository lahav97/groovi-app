/**
 * @module PhoneOrEmailScreen
 * Screen where users choose to log in using phone number or email address.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import PhoneInput from 'react-native-phone-number-input';
import * as Localization from 'expo-localization';
import Button from '../../components/common/Button';
import { Auth } from 'aws-amplify';

/**
 * @function getDefaultCountryCode
 * @description Retrieves the device's default country code for phone input.
 * @returns {string} Country code (e.g., 'IL', 'US')
 */
const getDefaultCountryCode = () => {
  const region = Localization.region;
  const locale = Localization.locale.split('-')[1];
  return region || locale || 'IL';
};

/**
 * @function PhoneOrEmailScreen
 * @description Allows users to log in either via phone number or email address.
 * @returns {JSX.Element} The PhoneOrEmailScreen component.
 */
const PhoneOrEmailScreen = () => {
  const [authMethod, setAuthMethod] = useState('phone');
  const [phone, setPhone] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const phoneInputRef = useRef(null);

  /**
   * @function handleContinue
   * @description Validates user input and signs in the user if valid.
   */
  const handleContinue = async () => {
    let valid = true;
    setAuthError('');
    
    if (!password) {
      setAuthError('Please enter a password');
      return;
    }

    if (authMethod === 'phone') {
      const isValid = phoneInputRef.current?.isValidNumber(formattedPhone);

      if (!isValid) {
        setAuthError('Please enter a valid phone number');
        return;
      } else {
        console.log('📞 Phone is valid:', formattedPhone);
        setIsLoading(true);
        
        try {
          await Auth.signIn({
            username: formattedPhone,
            password: password,
          });
          setIsLoading(false);
          navigation.navigate('Feed');
        } catch (error) {
          setIsLoading(false);
          console.error('Error signing in with phone:', error);
          
          if (error.code === 'UserNotFoundException') {
            setAuthError('Account not found. Please check your phone number.');
          } else if (error.code === 'NotAuthorizedException') {
            setAuthError('Incorrect password. Please try again.');
          } else {
            setAuthError(error.message || 'Failed to sign in. Please try again.');
          }
        }
      }
    } else {
      // Email authentication
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidEmail) {
        setAuthError('Please enter a valid email address');
        return;
      } else {
        console.log('📧 Email is valid:', email);
        setIsLoading(true);
        try {
          await Auth.signIn({
            username: email, 
            password: password,
          });
          setIsLoading(false);
          navigation.navigate('Feed');
        } catch (error) {
          setIsLoading(false);
          console.error('Error signing in with email:', error);
          
          if (error.code === 'UserNotFoundException') {
            setAuthError('Account not found. Please check your email.');
          } else if (error.code === 'NotAuthorizedException') {
            setAuthError('Incorrect password. Please try again.');
          } else {
            setAuthError(error.message || 'Failed to sign in. Please try again.');
          }
        }
      }
    }
  };

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="white" />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.title}>Log In</Text>

        <View style={styles.methodToggleContainer}>
          <TouchableOpacity
            onPress={() => {
              setAuthMethod('phone');
              setAuthError('');
            }}
            style={[styles.methodButton, authMethod === 'phone' && styles.methodSelected]}
          >
            <Text style={authMethod === 'phone' ? styles.methodTextSelected : styles.methodText}>Use Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setAuthMethod('email');
              setAuthError('');
            }}
            style={[styles.methodButton, authMethod === 'email' && styles.methodSelected]}
          >
            <Text style={authMethod === 'email' ? styles.methodTextSelected : styles.methodText}>Use Email</Text>
          </TouchableOpacity>
        </View>

        {authMethod === 'phone' ? (
          <PhoneInput
            ref={phoneInputRef}
            defaultValue={phone}
            value={phone}
            defaultCode={getDefaultCountryCode()}
            layout="first"
            onChangeText={(text) => setPhone(text)}
            onChangeFormattedText={(text) => setFormattedPhone(text)}
            containerStyle={styles.phoneInput}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={styles.phoneInputText}
            codeTextStyle={styles.codeTextStyle}
            textInputProps={{ 
              placeholderTextColor: '#666',
              placeholder: 'Phone Number'
            }}
          />
        ) : (
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholderTextColor="#666"
          secureTextEntry
        />

        {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

        <Button
          title={isLoading ? "Signing in..." : "Continue"}
          onPress={handleContinue}
          style={styles.continueButton}
          textStyle={styles.continueText}
          disabled={isLoading}
        />
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

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
  methodToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  methodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
  },
  methodSelected: { backgroundColor: 'white' },
  methodText: { color: 'white', fontWeight: 'bold' },
  methodTextSelected: { color: '#000', fontWeight: 'bold' },
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
  phoneInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    height: 48,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 20,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 0,
    height: '100%',
  },
  phoneInputText: { fontSize: 15, color: '#000' },
  codeTextStyle: { fontSize: 15, color: '#000' },
  errorText: {
    color: 'red',
    marginBottom: 12,
    marginLeft: 5,
    fontSize: 13,
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
});

export default PhoneOrEmailScreen;
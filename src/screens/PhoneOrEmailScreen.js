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
  const [authError, setAuthError] = useState('');
  const navigation = useNavigation();
  const phoneInputRef = useRef(null);

    /**
   * @function handleContinue
   * @description Validates user input and navigates to the next screen if valid.
   */
  const handleContinue = () => {
    let valid = true;

    if (authMethod === 'phone') {
      const isValid = phoneInputRef.current?.isValidNumber(formattedPhone);

      if (!isValid) {
        setAuthError('Please enter a valid phone number');
        valid = false;
      } else {
        setAuthError('');
        console.log('📞 Phone is valid:', formattedPhone);
      }
    } else {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!isValidEmail) {
        setAuthError('Please enter a valid email address');
        valid = false;
      } else {
        setAuthError('');
        console.log('📧 Email is valid:', email);
      }
    }

    if (!valid) return;

    // Proceed with verification logic later (e.g., Cognito)
    navigation.navigate('Feed');
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
            onPress={() => setAuthMethod('phone')}
            style={[styles.methodButton, authMethod === 'phone' && styles.methodSelected]}
          >
            <Text style={authMethod === 'phone' ? styles.methodTextSelected : styles.methodText}>Use Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAuthMethod('email')}
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
            textInputProps={{ placeholderTextColor: '#666' }}
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

        {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
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

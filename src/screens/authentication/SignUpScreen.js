/**
 * @module SignUpScreen
 * Handles user sign up with full name, username, email, password, birthday, and gender.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { useSignupBuilder } from '../../context/SignupFlowContext';
import { Auth } from 'aws-amplify';
import Button from '../../components/common/Button';
import axios from 'axios';
/**
 * @function SignUpScreen
 * @description Allows users to input their signup information and create an account.
 * @returns {JSX.Element}
 */
const SignUpScreen = () => {
  const navigation = useNavigation();
  const builder = useSignupBuilder();
  const [userType, setUserType] = React.useState('musician');
  const [fullName, setFullName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [gender, setGender] = React.useState('male');
  const [birthdayDate, setBirthdayDate] = React.useState(null);
  const [day, setDay] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [year, setYear] = React.useState('');
  const [showPicker, setShowPicker] = React.useState('');
  const [authError, setAuthError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [dateError, setDateError] = React.useState('');

  const CHECK_EMAIL_API_URL = 'https://9u6y4sfrn2.execute-api.us-east-1.amazonaws.com/groovi/build_profile/check_email?email=';
  /**
   * @function isValidPassword
   * @description Validates if a password has at least one capital letter and one number.
   * @param {string} value - Password to validate.
   * @returns {boolean}
   */
  const isValidPassword = (value) => /[A-Z]/.test(value) && /[0-9]/.test(value);
  
  /**
   * @function formatBirthday
   * @description Formats date object as a readable string.
   * @param {Date} date - Date object to format
   * @returns {string} Formatted date string
   */
  const formatBirthday = (date) => {
    if (!date) return 'Select Birthday';
    
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  /**
   * @function formatBirthdayForAPI
   * @description Formats date object as YYYY-MM-DD for API.
   * @param {Date} date - Date object to format
   * @returns {string} Formatted date string (YYYY-MM-DD)
   */
  const formatBirthdayForAPI = (date) => {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  /**
   * @function isEmailExists
   * @description Checks if an email is already registered.
   * @param {string} email - Email to check
   * @returns {Promise<boolean>}
   */
  const isEmailExists = async (email) => {
    try {
      const response = await axios.get(`${CHECK_EMAIL_API_URL}${email}`);
      return response.data.found === true;
    } catch (error) {
      console.error('Error checking if email exists:', error);
      return false;
    }
  };

  /**
   * @function isValidEmail
   * @description Validates an email string.
   * @param {string} email - Email to validate.
   * @returns {boolean}
   */
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  /**
   * @function handleDateUpdate
   * @description Updates the birthday date when day, month, or year changes
   */
  const handleDateUpdate = () => {
    if (day && month && year) {
      const selectedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Check if date is valid
      if (
        selectedDate.getFullYear() === parseInt(year) &&
        selectedDate.getMonth() === parseInt(month) - 1 &&
        selectedDate.getDate() === parseInt(day)
      ) {
        // Check if user is at least 13 years old
        const today = new Date();
        const thirteenYearsAgo = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
        
        if (selectedDate > thirteenYearsAgo) {
          setDateError('You must be at least 13 years old to sign up');
          setBirthdayDate(null);
        } else {
          setDateError('');
          setBirthdayDate(selectedDate);
        }
      } else {
        setDateError('Please enter a valid date');
        setBirthdayDate(null);
      }
    } else {
      setBirthdayDate(null);
    }
  };
  
  // Update birthday date when day, month, or year changes
  React.useEffect(() => {
    handleDateUpdate();
  }, [day, month, year]);
  
  // Generate arrays for days, months, and years for pickers
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: 100 }, 
    (_, i) => String(currentYear - i)
  );
  
  /**
   * @function handleContinue
   * @description Validates signup form and attempts to create a user account.
   */
  const handleContinue = async () => {
    let valid = true;

    // Validate email
    if (!isValidEmail(email)) {
      setAuthError('Enter a valid email address');
      valid = false;
    } else {
      try{
        const emailExists = await isEmailExists(email);
        
        if (emailExists) {
          setAuthError('This email is already registered');
          valid = false;
        }
        else{
          setAuthError('');
        }
      } catch (error) {
        console.error('Error checking if email exists:', error);
        setAuthError(''); 
      }
    }

    // Validate password
    if (!isValidPassword(password)) {
      setPasswordError('Password must contain at least 1 capital letter and 1 number');
      valid = false;
    } else {
      setPasswordError('');
    }

    // Validate birthday
    if (!birthdayDate) {
      setDateError('Please select your birthday');
      valid = false;
    }

    builder
      .setFullName(fullName)
      .setUsername(username)
      .setUserType(userType)
      .setPassword(password)
      .setGender(gender)
      .setBirthDate(formatBirthdayForAPI(birthdayDate))
      .setEmail(email)
      .setPhoneNumber(null);

    const user = builder.build();

    console.log('Signing up with user:', user);

    try {
      await Auth.signUp({
        username: user.username,
        password: user.password,
        attributes: {
          email: user.email || null,
          phone_number: null,
          name: user.fullName,
          gender: user.gender,
          locale: Localization.locale || 'en-US',
          picture: 'https://your-default-profile-url.com/default.png',
        },
      });
  
      console.log('✅ SignUp successful');
      navigation.navigate('Confirm Code', { username: user.username, password: user.password });
    }
    catch (error) {
      console.error('❌ Error signing up:', error);
      Alert.alert('Error', error.message || 'Failed to sign up.');
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <Text style={styles.title}>Sign Up</Text>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, userType === 'musician' && styles.toggleSelected]}
              onPress={() => setUserType('musician')}
            >
              <Text style={userType === 'musician' ? styles.toggleTextSelected : styles.toggleText}>
                Musician
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, userType === 'business' && styles.toggleSelected]}
              onPress={() => setUserType('business')}
            >
              <Text style={userType === 'business' ? styles.toggleTextSelected : styles.toggleText}>
                Business
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholderTextColor="#666"
          />

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {authError !== '' && <Text style={styles.errorText}>{authError}</Text>}

          {/* Birthday Selector */}
          <Text style={[styles.fieldLabel, { alignSelf: 'flex-start' }]}>Birthday</Text>
          <View style={styles.birthdayContainer}>
            {/* Day Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1, marginRight: 5 }]}
              onPress={() => setShowPicker(showPicker === 'day' ? '' : 'day')}
            >
              <Text style={styles.pickerButtonText}>{day || 'Day'}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
            
            {/* Month Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 2, marginHorizontal: 5 }]}
              onPress={() => setShowPicker(showPicker === 'month' ? '' : 'month')}
            >
              <Text style={styles.pickerButtonText}>
                {month ? months.find(m => m.value === month)?.label : 'Month'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
            
            {/* Year Picker */}
            <TouchableOpacity 
              style={[styles.pickerButton, { flex: 1.5, marginLeft: 5 }]}
              onPress={() => setShowPicker(showPicker === 'year' ? '' : 'year')}
            >
              <Text style={styles.pickerButtonText}>{year || 'Year'}</Text>
              <Ionicons name="chevron-down" size={18} color="#666" />
            </TouchableOpacity>
          </View>
          
          {/* Date Picker Overlay */}
          {showPicker ? (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>
                    Select {showPicker === 'day' ? 'Day' : showPicker === 'month' ? 'Month' : 'Year'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowPicker('')}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.pickerScrollView}>
                  {showPicker === 'day' && days.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.pickerItem,
                        day === item && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setDay(item);
                        setShowPicker('');
                      }}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          day === item && styles.pickerItemTextSelected
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {showPicker === 'month' && months.map(item => (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.pickerItem,
                        month === item.value && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setMonth(item.value);
                        setShowPicker('');
                      }}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          month === item.value && styles.pickerItemTextSelected
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  
                  {showPicker === 'year' && years.map(item => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.pickerItem,
                        year === item && styles.pickerItemSelected
                      ]}
                      onPress={() => {
                        setYear(item);
                        setShowPicker('');
                      }}
                    >
                      <Text 
                        style={[
                          styles.pickerItemText,
                          year === item && styles.pickerItemTextSelected
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}
          
          {dateError !== '' && <Text style={styles.errorText}>{dateError}</Text>}

          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholderTextColor="#666"
            autoCapitalize="none"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              style={styles.passwordInput}
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#666" />
            </TouchableOpacity>
          </View>
          {passwordError !== '' && <Text style={styles.errorText}>{passwordError}</Text>}

          <View style={styles.genderContainer}>
            <Text style={styles.genderLabel}>Gender</Text>
            <View style={styles.genderOptions}>
              <TouchableOpacity
                style={[styles.genderOption, gender === 'male' && styles.genderSelected]}
                onPress={() => setGender('male')}
              >
                <Text style={gender === 'male' ? styles.genderTextSelected : styles.genderText}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderOption, gender === 'female' && styles.genderSelected]}
                onPress={() => setGender('female')}
              >
                <Text style={gender === 'female' ? styles.genderTextSelected : styles.genderText}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title="Continue"
            onPress={() => {
              handleContinue();
            }}
            style={styles.continueButton}
            textStyle={styles.continueText}
          />
          
          <Text style={styles.termsText}>
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  inner: { 
    paddingTop: 110, 
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  backButton: { 
    position: 'absolute', 
    top: 60, 
    left: 20, 
    zIndex: 10 
  },
  title: {
    fontSize: 48,
    color: 'white',
    fontWeight: '900',
    marginBottom: 25,
    alignSelf: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 25,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    marginHorizontal: 10,
  },
  toggleSelected: { 
    backgroundColor: 'white' 
  },
  toggleText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  toggleTextSelected: { 
    color: '#000', 
    fontWeight: 'bold' 
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
  fieldLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  birthdayContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
  },
  pickerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#333',
    fontSize: 16,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '80%',
    maxHeight: '60%',
    padding: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(255, 110, 196, 0.2)',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#ff6ec4',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 12,
    marginLeft: 5,
    fontSize: 13,
    alignSelf: 'flex-start',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: '100%',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
  },
  genderContainer: {
    marginTop: 7,
    marginBottom: 20,
    width: '100%',
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: 'white',
    alignSelf: 'center',
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  genderOption: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'white',
    marginHorizontal: 5,
  },
  genderSelected: { 
    backgroundColor: 'white' 
  },
  genderText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
  genderTextSelected: { 
    color: '#000', 
    fontWeight: 'bold' 
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
  continueText: { 
    color: '#000', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  termsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  },
});

export default SignUpScreen;
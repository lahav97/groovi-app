import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_CLIENT_ID, GOOGLE_ANDROID_ID, FACEBOOK_APP_ID } from '@env';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen = () => {
  const navigation = useNavigation();

  const [fbRequest, fbResponse, promptFbLogin] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
    scopes: ['public_profile', 'email'],
  });

  const [googleRequest, googleResponse, promptGoogleLogin] = Google.useAuthRequest({
    expoClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_ID,
  });
  
  

  // You can leave these hooks if you want to debug token access
  // useEffect(() => {
  //   if (fbResponse?.type === 'success') {
  //     const { access_token } = fbResponse.params;
  //     console.log('📘 Facebook access token:', access_token);
  //     // Later: Trigger Cognito sign-in here
  //   }
  // }, [fbResponse]);

  // useEffect(() => {
  //   if (googleResponse?.type === 'success') {
  //     const { authentication } = googleResponse;
  //     console.log('🔵 Google access token:', authentication.accessToken);
  //     // Later: Trigger Cognito sign-in here
  //   }
  // }, [googleResponse]);

  return (
    <LinearGradient
      colors={['#ff6ec4', '#ffc93c', '#1c92d2']}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <Text style={styles.logo}>GROOVI</Text>

      <TouchableOpacity
        style={[styles.buttonBase, styles.whiteButton]}
        onPress={() => navigation.navigate('Sign Up')}
      >
        <Text style={styles.blackText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonBase, styles.whiteButton]}
        onPress={() => navigation.navigate('Phone Or Email')}
      >
        <Text style={styles.blackText}>Use phone or email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonBase, styles.googleButton]}
        onPress={() => promptGoogleLogin()}
      >
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.buttonBase, styles.fbButton]}
        onPress={() => promptFbLogin()}
      >
        <Text style={styles.fbText}>Continue with Facebook</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={styles.troubleText}>Trouble Logging In?</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  logo: {
    position: 'absolute',
    top: '25%',
    fontSize: 80,
    fontWeight: 'bold',
    color: 'white',
  },
  buttonBase: {
    width: '80%',
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  whiteButton: {
    backgroundColor: 'white',
  },
  fbButton: {
    backgroundColor: '#4267B2',
  },
  googleButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'white',
  },
  blackText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fbText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  googleText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  troubleText: {
    color: 'white',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 8,
  },
});

export default LoginScreen;

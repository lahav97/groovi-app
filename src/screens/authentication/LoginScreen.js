/**
 * @module LoginScreen
 * Displays login options including email/phone signup, Google and Facebook login.
 */
import React, { useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_CLIENT_ID, GOOGLE_ANDROID_ID, FACEBOOK_APP_ID } from '@env';
import { COLORS } from '../../styles/theme'; 
import { getGoogleProfile, getFacebookProfile, signInToCognito,} from '../../utils/socialAuth';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Button from '../../components/common/Button';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = 'https://auth.expo.io/@lahav97/groovi-app';
console.log('REDIRECT_URI', redirectUri);

/**
 * @function LoginScreen
 * @description Entry screen allowing users to log in or sign up using multiple authentication methods.
 * @returns {JSX.Element} The login screen component.
 */
const LoginScreen = () => {
  const navigation = useNavigation();

  const [fbRequest, fbResponse, promptFbLogin] = Facebook.useAuthRequest({
    clientId: FACEBOOK_APP_ID,
    scopes: ['public_profile', 'email'],
    responseType: 'token',
    useProxy: true,
    redirectUri,   
  });

  const [googleRequest, googleResponse, promptGoogleLogin] = Google.useAuthRequest({
    expoClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  /* ---------- GOOGLE response handler ---------- */
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { accessToken, expiresIn } = googleResponse.authentication;
  
      (async () => {
        const profile = await getGoogleProfile(accessToken);
        await signInToCognito('google', accessToken, expiresIn, profile);
  
        navigation.navigate('Feed');
      })().catch(console.error);
    }
  }, [googleResponse]);

  /* ---------- FACEBOOK response handler ---------- */
  useEffect(() => {
    if (fbResponse?.type === 'success' && fbResponse.authentication) {
      const { accessToken, expiresIn } = fbResponse.authentication;
  
      (async () => {
        const profile = await getFacebookProfile(accessToken);
        await signInToCognito('facebook', accessToken, expiresIn, profile);
        navigation.navigate('Feed');
      })().catch(console.error);
    }
  }, [fbResponse]);

  return (
    <LinearGradient
      colors={COLORS.static.primaryGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 0, y: 0 }}
      style={styles.container}
    >
      <Text style={[styles.logo, { color: COLORS.static.text }]}>GROOVI</Text>

      <Button
        title="Sign Up"
        onPress={() => navigation.navigate('SignupFlow')}
        style={[styles.buttonBase, styles.whiteButton]}
        textStyle={styles.blackText}
      />

      <Button
        title="Login with email"
        onPress={() => navigation.navigate('LoginWithEmail')}
        style={[styles.buttonBase, styles.whiteButton]}
        textStyle={styles.blackText}
      />

      <Button
        title="Continue with Google"
        onPress={() => promptGoogleLogin()}
        style={[styles.buttonBase, styles.googleButton]}
        textStyle={styles.googleText}
      />

      <Button
        title="Continue with Facebook"
        onPress={() => promptFbLogin()}
        style={[styles.buttonBase, styles.fbButton]}
        textStyle={styles.fbText}
      />

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

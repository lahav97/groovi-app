/**
 * @module LoginScreen
 * Displays login options including email/phone signup, Google and Facebook login.
 */
import React, { useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GOOGLE_CLIENT_ID, GOOGLE_ANDROID_ID, FACEBOOK_APP_ID } from '@env';
import { COLORS } from '../../styles/theme';
import { getGoogleProfile, getFacebookProfile, signInToCognito,} from '../../utils/socialAuth';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Button from '../../components/common/Button';
import ScrollingText from '../../components/common/ScrollingText';  // ← ADD THIS LINE
import {
    handleError
} from '../../utils/errors';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = 'https://auth.expo.io/@lahav97/groovi-app';

/**
 * @function LoginScreen
 * @description Entry screen allowing users to log in or sign up using multiple authentication methods.
 * @returns {JSX.Element} The login screen component.
 */
const LoginScreen = () => {
    const navigation = useNavigation();

    // Commented out Facebook auth setup
    // const [fbRequest, fbResponse, promptFbLogin] = Facebook.useAuthRequest({
    //   clientId: FACEBOOK_APP_ID,
    //   scopes: ['public_profile', 'email'],
    //   responseType: 'token',
    //   useProxy: true,
    //   redirectUri,
    // });

    // Commented out Google auth setup
    // const [googleRequest, googleResponse, promptGoogleLogin] = Google.useAuthRequest({
    //   expoClientId: GOOGLE_CLIENT_ID,
    //   androidClientId: GOOGLE_ANDROID_ID,
    //   redirectUri,
    //   scopes: ['openid', 'profile', 'email'],
    // });

    // Commented out Google response handler
    // useEffect(() => {
    //   if (googleResponse?.type === 'success') {
    //     const { accessToken, expiresIn } = googleResponse.authentication;

    //     (async () => {
    //       try {
    //         const profile = await getGoogleProfile(accessToken);
    //         await signInToCognito('google', accessToken, expiresIn, profile);
    //         navigation.navigate('Feed');
    //       } catch (error) {
    //         console.error(handleError(error, 'LoginScreen/Google'));
    //       }
    //     })();
    //   }
    // }, [googleResponse]);

    // Commented out Facebook response handler
    // useEffect(() => {
    //   if (fbResponse?.type === 'success' && fbResponse.authentication) {
    //     const { accessToken, expiresIn } = fbResponse.authentication;

    //     (async () => {
    //       try {
    //         const profile = await getFacebookProfile(accessToken);
    //         await signInToCognito('facebook', accessToken, expiresIn, profile);
    //         navigation.navigate('Feed');
    //       } catch (error) {
    //         console.error(handleError(error, 'LoginScreen/Facebook'));
    //       }
    //     })();
    //   }
    // }, [fbResponse]);

    return (
        <LinearGradient
            colors={COLORS.static.primaryGradient}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.container}
        >
            {/* Animated Scrolling Background */}
            <ScrollingText
                text="GROOVI"
                speed={30}
                opacity={0.08}
                fontSize={50}
                color="white"
                angle={-12}
            />

            {/* Header Section with Logo and Description */}
            <View style={styles.headerSection}>
                <Text style={[styles.logo, { color: COLORS.static.text }]}>GROOVI</Text>
                <Text style={styles.tagline}>Your Music, Your Vibe, Your World</Text>
                <Text style={styles.description}>
                    Discover and share the music that moves you.{'\n'}
                    Connect with fellow music lovers worldwide.
                </Text>
            </View>

            {/* Button Section */}
            <View style={styles.buttonSection}>
                <Button
                    title="Sign Up"
                    onPress={() => navigation.navigate('SignupFlow')}
                    style={[styles.buttonBase, styles.primaryButton]}
                    textStyle={styles.primaryButtonText}
                />

                <Button
                    title="Login With Email"
                    onPress={() => navigation.navigate('LoginWithEmail')}
                    style={[styles.buttonBase, styles.secondaryButton]}
                    textStyle={styles.secondaryButtonText}
                />

                {/* Commented out Google login button */}
                {/* <Button
            title="Continue With Google"
            onPress={() => promptGoogleLogin()}
            style={[styles.buttonBase, styles.googleButton]}
            textStyle={styles.googleText}
          /> */}

                {/* Commented out Facebook login button */}
                {/* <Button
            title="Continue With Facebook"
            onPress={() => promptFbLogin()}
            style={[styles.buttonBase, styles.fbButton]}
            textStyle={styles.fbText}
          /> */}

                <TouchableOpacity>
                    <Text style={styles.troubleText}>Trouble Logging In?</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    headerSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 40,
    },
    buttonSection: {
        width: '100%',
        alignItems: 'center',
        paddingBottom: 20,
    },
    logo: {
        fontSize: 80,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 20,
        textAlign: 'center',
    },
    tagline: {
        fontSize: 20,
        fontWeight: '600',
        color: 'white',
        textAlign: 'center',
        marginBottom: 16,
        opacity: 0.95,
    },
    description: {
        fontSize: 16,
        color: 'white',
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.85,
        paddingHorizontal: 10,
    },
    buttonBase: {
        width: '85%',
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    primaryButton: {
        backgroundColor: 'white',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: 'white',
    },
    primaryButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    troubleText: {
        color: 'white',
        textDecorationLine: 'underline',
        fontSize: 14,
        marginTop: 24,
        opacity: 0.9,
    },
    // Commented out social login button styles
    // fbButton: {
    //   backgroundColor: '#4267B2',
    // },
    // googleButton: {
    //   backgroundColor: 'white',
    //   borderWidth: 1,
    //   borderColor: 'white',
    // },
    // fbText: {
    //   color: 'white',
    //   fontSize: 16,
    //   fontWeight: 'bold',
    //   textAlign: 'center',
    // },
    // googleText: {
    //   color: '#4285F4',
    //   fontSize: 16,
    //   fontWeight: 'bold',
    //   textAlign: 'center',
    // },
});

export default LoginScreen;
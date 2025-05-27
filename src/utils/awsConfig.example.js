/**
 * AWS Amplify Configuration Template
 * 
 * This is a template file showing the structure of AWS configuration needed for the app.
 * Copy this file to awsConfig.js and replace the placeholder values with your actual AWS credentials.
 * 
 * IMPORTANT: Never commit awsConfig.js to version control - it contains sensitive information!
 */

export default {
  Auth: {
    // AWS Region where your Cognito User Pool is located
    region: 'us-east-1',
    
    // Your Cognito User Pool ID (found in AWS Cognito console)
    // Format: us-east-1_XXXXXXXXX
    userPoolId: 'us-east-1_XXXXXXXXX',
    
    // Your Cognito User Pool Web Client ID (found in App clients section)
    // Format: long alphanumeric string
    userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
    
    // Your Cognito Identity Pool ID (for federated identities)
    // Format: us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
    identityPoolId: 'us-east-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',

    oauth: {
      // Your Cognito domain (found in App integration > Domain name)
      // Format: your-domain.auth.region.amazoncognito.com
      domain: 'your-app-domain.auth.us-east-1.amazoncognito.com',
      
      // Redirect URLs for successful sign-in
      // Add both your custom scheme and Expo auth URL
      redirectSignIn: [
        'your-app://redirect/',
        'https://auth.expo.io/@your-expo-username/your-app-slug'
      ],
      
      // Redirect URLs for sign-out
      redirectSignOut: [
        'your-app://redirect/',
        'https://auth.expo.io/@your-expo-username/your-app-slug'
      ],

      // OAuth response type - use 'code' for security
      responseType: 'code',
      
      // OAuth scopes - what information you want access to
      scope: ['openid', 'email', 'profile'],
    },
  },
};

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Copy this file to awsConfig.js:
 *    cp src/utils/awsConfig.example.js src/utils/awsConfig.js
 * 
 * 2. Replace ALL placeholder values with your actual AWS credentials:
 *    - Get these from your AWS Cognito console
 *    - User Pool ID: Amazon Cognito > User pools > [Your pool] > General settings
 *    - App Client ID: Amazon Cognito > User pools > [Your pool] > App clients
 *    - Identity Pool ID: Amazon Cognito > Identity pools > [Your pool]
 *    - Domain: Amazon Cognito > User pools > [Your pool] > App integration > Domain name
 * 
 * 3. Update redirect URLs:
 *    - Replace 'your-app' with your actual app scheme (from app.json)
 *    - Replace 'your-expo-username' with your Expo username
 *    - Replace 'your-app-slug' with your app slug (from app.json)
 * 
 * 4. Configure these URLs in AWS Cognito:
 *    - Go to User pools > [Your pool] > App integration > App client settings
 *    - Add your redirect URLs to "Allowed callback URLs" and "Allowed sign out URLs"
 * 
 * 5. Test your configuration:
 *    - Run: npx expo start -c
 *    - Try signing up/signing in
 */
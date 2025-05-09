export default {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_expDfdboP',
    userPoolWebClientId: '78pip8tfv6r1ocg8jc3ak62gnk',
    identityPoolId: 'us-east-1:abcd1234-ef56-7890-ab12-34567890abcd',

    oauth: {
      domain: 'groovi.auth.us-east-1.amazoncognito.com',
      redirectSignIn: [
        'groovi://redirect/',
        'https://auth.expo.io/@lahav97/groovi-app'
      ],
      redirectSignOut: [
        'groovi://redirect/',
        'https://auth.expo.io/@lahav97/groovi-app'
      ],

      // OAuth response type and scopes
      responseType: 'code',
      scope: ['openid', 'email', 'profile'],
    },
  },
};

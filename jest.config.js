module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(expo|expo-asset|expo-constants|expo-font|expo-linear-gradient|expo-modules-core|expo-auth-session|expo-web-browser|expo-localization|react-native-phone-number-input|react-native-country-picker-modal|@expo|@react-native|react-native|react-native-vector-icons)/)',
  ],
};

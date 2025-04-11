// __mocks__/react-native-country-picker-modal.js
import React from 'react';
import { View, Text } from 'react-native';

export default function CountryPicker() {
  return (
    <View>
      <Text>🇮🇱 Country Picker</Text>
    </View>
  );
}

// This simulates getting the default country code ("IL")
export const getCountryCodeAsync = jest.fn(() => Promise.resolve('IL'));

// This simulates getting the calling code for IL ("972")
export const getCallingCode = jest.fn(() => Promise.resolve('972'));

// This wraps children, needed for some components like PhoneInput
export const CountryModalProvider = ({ children }) => <>{children}</>;

// Optional mocks for components
export const Flag = () => <Text>🇮🇱</Text>;

// __mocks__/react-native-phone-number-input.js
import React from 'react';
import { View, TextInput } from 'react-native';

const PhoneInput = React.forwardRef(({ onChangeFormattedText }, ref) => {
  return (
    <View>
      <TextInput
        placeholder="Mock phone input"
        onChangeText={(text) => {
          if (onChangeFormattedText) onChangeFormattedText(text);
        }}
      />
    </View>
  );
});

export default PhoneInput;

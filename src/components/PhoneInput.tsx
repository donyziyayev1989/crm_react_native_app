import { InputProps } from '@/interfaces/index';
import React from 'react';
import { StyleSheet } from 'react-native';
import MaskInput from 'react-native-mask-input';

const phoneMask = [
  '+', '9', '9', '8', ' ', /\d/, /\d/, ' ', /\d/, /\d/, /\d/, '-', /\d/, /\d/, '-', /\d/, /\d/
];

const PhoneInput = ({ name, value, onChange, errors, placeholder, ...props }: InputProps & { onFocus?: any, onBlur?: any }) => {
  return (
    <MaskInput
      {...props as any}
      value={value}
      onChangeText={(masked, unmasked) => {
        if (masked === '+' || masked === '+9' || masked === '+99' || masked === '+998' || masked === '+998 ' || masked === '+998 (') {
          onChange('');
        } else {
          onChange(masked); 
        }
      }}
      onFocus={(e) => {
        if (!value) {
          onChange('+998 ');
        }
        if (props.onFocus) props.onFocus(e);
      }}
      onBlur={(e) => {
        if (value === '+998 ' || value === '+998') {
          onChange('');
        }
        if (props.onBlur) props.onBlur(e);
      }}
      mask={phoneMask}
      style={[styles.input, errors?.[name] && styles.inputError]}
      placeholder={placeholder || "+998 (__) ___-__-__"}
      placeholderTextColor="#9ca3af"
      keyboardType="phone-pad"
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    shadowColor: '#555',
    shadowOffset: {
        width: 0,
        height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
  },
  inputError: {
    borderColor: '#ef4444',
  },
});

export default PhoneInput;
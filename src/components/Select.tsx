import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Dropdown, MultiSelect } from 'react-native-element-dropdown';

interface SelectProps {
    data: any;
    placeholder: string;
    searchPlaceholder: string;
    search?: boolean;
    maxHeight?: number;
    multiSelect?: boolean;
    onChange?: (value: any) => void;
    value?: any;
    name?: string;
    errors?: any;
}

const Select = ({data, placeholder, searchPlaceholder, search, maxHeight, multiSelect, onChange, value: propValue, name, errors}: SelectProps) => {
  const [value, setValue] = useState<any>(null);
  const [isFocus, setIsFocus] = useState(false);
  const [selected, setSelected] = useState<any>([]);

  if(multiSelect) {
    return <MultiSelect
          style={styles.dropdown}
          inputSearchStyle={styles.inputSearchStyle}
          iconStyle={styles.iconStyle}
          data={data}
          labelField="label"
          valueField="value"
          placeholder={placeholder}
          value={selected}
          search
          searchPlaceholder={searchPlaceholder}
          onChange={item => {
            setSelected(item);
            if (onChange) onChange(item);
          }}
          renderRightIcon={() => (
            <MaterialIcons name="keyboard-arrow-down" style={styles.icon} size={16} color={isFocus ? 'blue' : 'black'} />
         )}
          renderSelectedItem={(item, unSelect) => (
            <TouchableOpacity onPress={() => unSelect && unSelect(item)}>
              <View style={styles.selectedStyle}>
                <Text style={styles.textSelectedStyle}>{item.label}</Text>
                <MaterialIcons color="red" name="delete-outline" size={17} />
              </View>
            </TouchableOpacity>
          )}
        />
  }

  return (
   <Dropdown
        style={[styles.dropdown, isFocus && styles.focus, name && errors?.[name] && styles.errorInput]}
        data={data}
        search={search}
        maxHeight={maxHeight}
        labelField="label"
        valueField="value"
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        inputSearchStyle={styles.inputSearchStyle}
        value={propValue !== undefined ? propValue : value}
        onChange={(item) => {
          setValue(item.value);
          if (onChange) onChange(item.value);
          setIsFocus(false);
        }}
        onFocus={() => setIsFocus(true)}
        onBlur={() => setIsFocus(false)}
        renderRightIcon={() => (
            isFocus ? 
                <MaterialIcons name="keyboard-arrow-up" style={styles.icon} size={16} color='blue' /> 
                : 
                <MaterialIcons name="keyboard-arrow-down" style={styles.icon} size={16} color='black' />
        )}
      />
  )
}

const styles = StyleSheet.create({
    container: {
        margin: 16,
    },
    inputSearchStyle: {
        height: 40,
        fontSize: 16,
        },
    dropdown: {
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

        elevation: 2,
    },
    icon: {
        marginRight: 8,
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
    },
    focus: {
        borderColor: '#9ca3af',
    },
    selectedStyle: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 14,
      backgroundColor: 'white',
      shadowColor: '#555',
      marginTop: 8,
      marginRight: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,

      elevation: 2,
    },
    textSelectedStyle: {
      marginRight: 5,
      fontSize: 16,
    },
    iconStyle: {
      width: 20,
      height: 20,
    },
    errorInput: {
      borderColor: '#ef4444',
      shadowColor: '#ef4444',
    },
})

export default Select
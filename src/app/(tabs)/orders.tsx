import { Link, Stack } from 'expo-router';
import React from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';

function LogoTitle(props: any) {
  return (
    <Link href="/">
      <Image style={styles.image} source={{ uri: 'https://reactnative.dev/img/tiny_logo.png' }} />
    </Link>
  );
}

const Orders = () => {
  return (
    <>
    <Stack.Screen options={{ 
        headerTitle: (props) => <LogoTitle {...props} />,
        headerLeft: ({tintColor, canGoBack, label, href }) => (
          <Link href="/" className='text-primary'>Back</Link>
        ),
        headerRight: ({tintColor, canGoBack }) => (
          <Button onPress={() => {}} title="Add" color={tintColor} />
        ),
        }} />
    <View>
      <Text>Orders</Text>
    </View>
    </>
  )
}

export default Orders

const styles = StyleSheet.create({
  image: {
    width: 50,
    height: 50,
  },
});
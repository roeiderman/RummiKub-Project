import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import UserMenu from '../components/UserMenu';

export default function RootLayout() {
  useEffect(() => {
    // Suppress reanimated warnings about .value in inline styles
    LogBox.ignoreLogs([
      'It looks like you might be using shared value\'s .value inside reanimated inline style',
    ]);
  }, []);

  return (
    <>
      <Stack screenOptions={{
        headerShown: false,
        gestureEnabled: false,  // Disable swipe-back gesture globally
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="edit" />
        <Stack.Screen name="edit-board" />
        <Stack.Screen name="edit-rack" />
        <Stack.Screen name="leaderboard" />
      </Stack>
      <UserMenu />
      <StatusBar style="light" />
    </>
  );
}

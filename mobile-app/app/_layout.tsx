import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View, Text, StyleSheet } from 'react-native';
import UserMenu from '../components/UserMenu';
import { setSessionExpiredHandler } from '../src/services/apiClient';

export default function RootLayout() {
  const router = useRouter();
  const [sessionExpiredVisible, setSessionExpiredVisible] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSessionExpiredVisible(true);
      setTimeout(() => {
        setSessionExpiredVisible(false);
        router.replace('/');
      }, 2500);
    });

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
        <Stack.Screen name="solution-screen" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenge-play" />
      </Stack>
      <UserMenu />
      {sessionExpiredVisible && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Session expired. Redirecting to login...
          </Text>
        </View>
      )}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});

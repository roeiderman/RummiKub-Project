import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

const STATUS_MESSAGES = [
  'Scanning tiles...',
  'Analyzing board...',
  'Finding the best move...',
];

export default function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((current) => (current + 1) % STATUS_MESSAGES.length);
    }, 1400);

    return () => {
      clearInterval(messageTimer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Rummikub AI</Text>
        <Text style={styles.title}>Preparing your edit screen</Text>

        <LottieView
          source={require('../assets/animations/fish.json')}
          autoPlay
          loop
          style={styles.animation}
        />

        <Text style={styles.message}>{STATUS_MESSAGES[messageIndex]}</Text>
        <Text style={styles.caption}>Your board is being processed in the background.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderRadius: 28,
    backgroundColor: '#afdbb1',
    borderWidth: 1,
    borderColor: '#1F3352',
  },
  eyebrow: {
    color: '#364837',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 10,
    color: '#F8FAFC',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  animation: {
    width: 220,
    height: 220,
    marginTop: 18,
    marginBottom: 6,
  },
  message: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  caption: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

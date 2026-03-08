import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS } from '@/src/constants/colors';
import { registerUser } from '@/src/services/authService';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    try {
      const result = await registerUser({ name, email, password });
      console.log('Register success:', result);
    } catch (error) {
      console.log('Register error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🎲</Text>
        <Text style={styles.title}>Rummikub AI{'\n'}Assistant</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign-Up</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#6f6a95"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6f6a95"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6f6a95"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signUpButton} onPress={handleRegister}>
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    fontSize: 28,
    marginBottom: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 520,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 36,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  linkText: {
    color: COLORS.link,
    fontSize: 14,
  },
  signUpButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  signUpButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
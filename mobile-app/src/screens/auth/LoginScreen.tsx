import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter  } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { loginUser } from '../../services/authService';
import { getAccessToken, getRefreshToken, storeSessionTokens } from '../../services/sessionService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const router = useRouter();

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const accessToken = await getAccessToken();

        if (accessToken && !isTokenExpired(accessToken)) {
          router.replace('/home');
          return;
        }

        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          setIsCheckingSession(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          await storeSessionTokens(data.data.accessToken, undefined);
          router.replace('/home');
        } else {
          setIsCheckingSession(false);
        }
      } catch {
        setIsCheckingSession(false);
      }
    }

    checkExistingSession();
  }, []);

  if (isCheckingSession) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const handleSignIn = async () => {
    // Client-side validation for instant feedback
    if (!email || !password) {
      Alert.alert('Validation Error', 'Email and password are required');
      return;
    }

    // Simple email format validation
    const isValidEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
    if (!isValidEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    try {
      const result = await loginUser({ email, password });
      console.log('Login success:', result);
      router.replace('/home');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Login Failed', errorMessage);
    }
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>🎲</Text>
        <Text style={styles.title}>Rummikub AI{'\n'}Assistant</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sign-In</Text>

        <Text style={styles.label}>Sign in with email</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#000000"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#000000"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* <Text style={styles.footerText}>
          By signing up you agree to the{' '}
          <Text style={styles.linkText}>Terms of Service</Text> and{' '}
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Text> */}
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
    color: COLORS.text2,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 36,
  },
  label: {
    color: COLORS.text2,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 18,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    color: COLORS.text2,
    fontSize: 16,
    paddingVertical: 12,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 18,
  },
  linkText: {
    color: COLORS.link,
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  signInButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    color: COLORS.mutedText,
    fontSize: 13,
    marginTop: 28,
    lineHeight: 20,
  },
});
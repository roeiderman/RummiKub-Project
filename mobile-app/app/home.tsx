import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomePage() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Logged in successfully</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 18,
    marginBottom: 30,
  },

  button: {
    backgroundColor: '#5c6cff',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },

  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
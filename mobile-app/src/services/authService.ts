import * as SecureStore from 'expo-secure-store';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export async function loginUser(payload: LoginPayload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (data.data.accessToken) {
      // SAVE THE TOKEN TO THE VAULT
      await SecureStore.setItemAsync('accessToken', data.data.accessToken);
  }
    if (data.data.refreshToken) {
      await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
  }

  console.log(data.data);
  console.log(data.data.accessToken);


  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'Login failed');
  }

  return data;
}

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'Registration failed');
  }

  return data;
}
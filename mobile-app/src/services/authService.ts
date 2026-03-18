import { clearSession, SessionUser, storeSessionTokens, storeSessionUser } from './sessionService';
import { apiFetch } from './apiClient';
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

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || data.message || 'Login failed');
  }

  const data = await response.json();

  await storeSessionTokens(data.data?.accessToken, data.data?.refreshToken);
  await storeSessionUser(data.data?.user as SessionUser | undefined);

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

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || data.message || 'Registration failed');
  }

  return response.json();
}

export async function logoutUser() {
  try {
    await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
  } catch {
    // Ignore errors — clear local session regardless
  }
  await clearSession();
}

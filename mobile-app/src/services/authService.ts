import { clearSession, SessionUser, storeSessionTokens, storeSessionUser } from './sessionService';
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

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'Login failed');
  }

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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || data.message || 'Registration failed');
  }

  return data;
}

export async function logoutUser() {
  await clearSession();
}

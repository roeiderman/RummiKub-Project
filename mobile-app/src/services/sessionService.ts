import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export type SessionUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
};

export async function storeSessionTokens(accessToken?: string, refreshToken?: string) {
  if (accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function storeSessionUser(user?: SessionUser | null) {
  if (!user) {
    return;
  }

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getSessionUser() {
  const rawUser = await SecureStore.getItemAsync(USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as SessionUser;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

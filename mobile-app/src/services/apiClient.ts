import { getAccessToken, getRefreshToken, storeSessionTokens, clearSession } from './sessionService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired. Please log in again.');
    this.name = 'SessionExpiredError';
  }
}

// Set this handler in _layout.tsx to redirect to login when session expires
let _onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  _onSessionExpired = handler;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function attemptRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearSession();
    throw new SessionExpiredError();
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    throw new SessionExpiredError();
  }

  const data = await response.json();
  const newAccessToken: string = data.data.accessToken;
  await storeSessionTokens(newAccessToken, undefined);
  return newAccessToken;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status !== 401) {
    return response;
  }

  // Got a 401 — attempt silent token refresh
  if (isRefreshing) {
    // Another refresh is already in flight; queue this request
    return new Promise((resolve, reject) => {
      refreshQueue.push((newToken) => {
        if (!newToken) {
          reject(new SessionExpiredError());
          return;
        }
        headers.set('Authorization', `Bearer ${newToken}`);
        fetch(url, { ...options, headers }).then(resolve).catch(reject);
      });
    });
  }

  isRefreshing = true;
  try {
    const newToken = await attemptRefresh();
    refreshQueue.forEach((cb) => cb(newToken));
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(url, { ...options, headers });
  } catch (err) {
    refreshQueue.forEach((cb) => cb(null));
    if (_onSessionExpired) _onSessionExpired();
    throw err;
  } finally {
    refreshQueue = [];
    isRefreshing = false;
  }
}

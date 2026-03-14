import { getAccessToken } from './sessionService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export type LeaderboardSortBy = 'maxTilesInOneTurn' | 'totalTurns';

export interface LeaderboardEntry {
  email: string;
  totalTurns: number;
  maxTilesInOneTurn: number;
}

async function getAuthHeader(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication token not found. Please log in again.');
  return `Bearer ${token}`;
}

export async function recordTurn(tilesPlayed: number): Promise<void> {
  const auth = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/api/leaderboard/turn`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tilesPlayed }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to record turn');
  }
}

export async function getLeaderboard(sortBy: LeaderboardSortBy = 'maxTilesInOneTurn'): Promise<LeaderboardEntry[]> {
  const auth = await getAuthHeader();
  const response = await fetch(`${API_BASE_URL}/api/leaderboard?sortBy=${sortBy}`, {
    headers: { Authorization: auth },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch leaderboard');
  }
  return data.data as LeaderboardEntry[];
}

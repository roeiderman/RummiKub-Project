import { apiFetch } from './apiClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export type LeaderboardSortBy = 'maxTilesInOneTurn' | 'totalTurns';

export interface LeaderboardEntry {
  email: string;
  totalTurns: number;
  maxTilesInOneTurn: number;
}

export async function recordTurn(tilesPlayed: number): Promise<void> {
  const response = await apiFetch(`${API_BASE_URL}/api/leaderboard/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tilesPlayed }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to record turn');
  }
}

export async function getLeaderboard(sortBy: LeaderboardSortBy = 'maxTilesInOneTurn'): Promise<LeaderboardEntry[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/leaderboard?sortBy=${sortBy}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch leaderboard');
  }
  return data.data as LeaderboardEntry[];
}

import { apiFetch } from './apiClient';
import { RummikubTile } from '../types/tile';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export interface ScenarioRecord {
  email: string;
  tilesPlaced: number;
  achievedAt: string;
}

export interface Scenario {
  id: string;
  rack: RummikubTile[];
  board: RummikubTile[][];
  algorithmTilesRemoved: number;
  recordHolder: ScenarioRecord | null;
  createdAt: string;
}

export interface AttemptResult {
  tilesPlaced: number;
  isNewRecord: boolean;
  previousRecord: number;
}

export interface ScenarioLeaderboardEntry {
  email: string;
  bestScore: number;
  attempts?: number;
  achievedAt?: string;
  isAI: boolean;
}

export async function listScenarios(): Promise<Scenario[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/scenarios`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch scenarios');
  }
  return data.data as Scenario[];
}

export async function getScenario(id: string): Promise<Scenario> {
  const response = await apiFetch(`${API_BASE_URL}/api/scenarios/${id}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch scenario');
  }
  return data.data as Scenario;
}

export async function submitAttempt(
  scenarioId: string,
  submittedBoard: RummikubTile[][],
  tilesPlaced: number
): Promise<AttemptResult> {
  const response = await apiFetch(`${API_BASE_URL}/api/scenarios/${scenarioId}/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submittedBoard, tilesPlaced }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to submit attempt');
  }
  return data.data as AttemptResult;
}

export async function getScenarioLeaderboard(scenarioId: string): Promise<ScenarioLeaderboardEntry[]> {
  const response = await apiFetch(`${API_BASE_URL}/api/scenarios/${scenarioId}/leaderboard`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch leaderboard');
  }
  return data.data as ScenarioLeaderboardEntry[];
}

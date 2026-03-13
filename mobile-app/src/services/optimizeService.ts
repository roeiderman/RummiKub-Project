import * as SecureStore from 'expo-secure-store';
import { TileData } from '../types/tile';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export interface OptimalMove {
  tilesUsed: TileData[];
  moveType: 'extend' | 'new_series';
  seriesIndex?: number;
  newSeries?: TileData[];
  seriesType?: 'run' | 'set';
}

export interface OptimizeResult {
  boardValid: boolean;
  optimalMove: OptimalMove;
  tilesPlayed: number;
  updatedGroups: TileData[][];
  remainingRack: TileData[];
}

export interface OptimizeResponse {
  success: boolean;
  data: OptimizeResult;
  message: string;
}

export const findOptimalMove = async (
  groups: TileData[][],
  rack: TileData[]
): Promise<OptimizeResponse> => {
  try {
    // Get token from secure storage
    const token = await SecureStore.getItemAsync('accessToken');

    if (!token) {
      throw new Error('Authentication token not found. Please log in again.');
    }

    // Make API request
    const response = await fetch(`${API_BASE_URL}/api/optimize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        groups,
        rack,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Log error for debugging (only in development)
      if (__DEV__) {
        console.log('=== OPTIMIZE API ERROR ===');
        console.log('Status:', response.status);
        console.log('Type:', data.error?.type);
        console.log('Message:', data.error?.message);
        console.log('==========================');
      }

      // Handle board validation errors specifically
      if (data.error?.type === 'BoardInvalidError' && data.error?.details) {
        const errorDetails = data.error.details;

        // Create a structured error object with details
        const error: any = new Error(data.error.message);
        error.type = 'BoardInvalidError';
        error.invalidGroups = errorDetails.invalidGroups || [];

        throw error;
      }

      throw new Error(data.error?.message || 'Failed to find optimal move');
    }

    return data;
  } catch (error) {
    // Re-throw for handling in the UI layer
    throw error;
  }
};

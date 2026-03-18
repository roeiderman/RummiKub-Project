import { RummikubTile, OptimizeResponse } from '../types/tile';
import { apiFetch } from './apiClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export const findOptimalMove = async (
  groups: RummikubTile[][],
  rack: RummikubTile[]
): Promise<OptimizeResponse> => {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/optimize`, {
      method: 'POST',
      headers: {
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

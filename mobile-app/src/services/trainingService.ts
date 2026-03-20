import { apiFetch } from './apiClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export async function deleteTrainingImage(detectionId: string) {
  try {
    await apiFetch(`${API_BASE_URL}/api/training/image/${detectionId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[Training] Could not delete image:', err);
  }
}

export async function submitCorrection(payload: {
  detectionId: string;
  isRack: boolean;
  correctedTiles: any[];
  imageWidth: number;
  imageHeight: number;
}) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/training/correction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('[Training] Failed to submit correction:', data);
    }
  } catch (err) {
    // Fire-and-forget — don't block the user if training upload fails
    console.warn('[Training] Could not submit correction:', err);
  }
}

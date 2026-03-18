import * as ImageManipulator from 'expo-image-manipulator';
import { apiFetch, SessionExpiredError } from './apiClient';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export const uploadImageForDetection = async (imageUri: string, groupFlag: boolean) => {
  try {
    let processedUri = imageUri;

    // Convert HEIF/HEIC images to JPEG (iPhone compatibility)
    const isHeif = imageUri.toLowerCase().includes('.heic') || imageUri.toLowerCase().includes('.heif');

    if (isHeif) {
      console.log('Converting HEIF image to JPEG...');
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [], // No transformations, just convert format
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      processedUri = manipulatedImage.uri;
      console.log('Image converted successfully');
    }

    const formData = new FormData();

    // Append the parameters as form fields
    formData.append('groupFlag', groupFlag.toString());
    formData.append('annotate', 'true');

    // Append the Image
    formData.append('image', {
      uri: processedUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);

    // Send to Node.js backend
    // Don't set Content-Type manually - let FormData set it with boundary
    const response = await apiFetch(`${API_BASE_URL}/api/detection`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to analyze image');
    }

    return data;

  } catch (error) {
    if (!(error instanceof SessionExpiredError)) {
      console.error(`API Upload Error (groupFlag: ${groupFlag}):`, error);
    }
    throw error;
  }
};
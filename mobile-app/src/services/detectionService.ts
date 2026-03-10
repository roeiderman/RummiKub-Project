const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export const uploadImageForDetection = async (imageUri: string, groupFlag: boolean, token: string) => {
  try {
    const formData = new FormData();

    formData.append('groupFlag', groupFlag ? 'true' : 'false');
    formData.append('annotate', 'true');

    // Append the Image
    formData.append('image', {
      uri: imageUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);

    // Send to Node.js backend
    const response = await fetch(`${API_BASE_URL}/api/detection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to analyze image');
    }
    console.log(data);

    return data; 

  } catch (error) {
    console.error(`API Upload Error (groupFlag: ${groupFlag}):`, error);
    throw error;
  }
};
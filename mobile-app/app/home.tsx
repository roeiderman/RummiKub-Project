import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// Ionicons comes pre-installed with Expo!
import { Ionicons } from '@expo/vector-icons';
import LoadingScreen from '../components/LoadingScreen';
import { uploadImageForDetection } from '../src/services/detectionService';
import { SessionExpiredError } from '../src/services/apiClient';

export default function HomeScreen() {
  const router = useRouter();
  const [rackImage, setRackImage] = useState<string | null>(null);
  const [boardImage, setBoardImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. The Pop-up Menu
  const showImageOptions = (type: 'rack' | 'board') => {
    Alert.alert(
      `Upload ${type === 'rack' ? 'Rack' : 'Board'}`,
      'Where would you like to get the image from?',
      [
        { text: 'Take Photo', onPress: () => processImageSelection(type, 'camera') },
        { text: 'Choose from Gallery', onPress: () => processImageSelection(type, 'gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // 2. The actual Camera/Gallery logic
  const processImageSelection = async (type: 'rack' | 'board', source: 'camera' | 'gallery') => {
    let result;

    if (source === 'camera') {
      // Handle Camera
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera access to take a photo.');
        return;
      }

      result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      });

    } else {
      // Handle Gallery
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery access to pick a photo.');
        return;
      }
      
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], 
        quality: 0.8,
      });
    }

    // Save the image URI to the correct state variable
    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (type === 'rack') setRackImage(result.assets[0].uri);
      else setBoardImage(result.assets[0].uri);
    }
  };

  // Function to handle the Continue button
  const handleContinue = async () => {
    if (!rackImage || !boardImage) return;

    setIsLoading(true);
    try {
      
      const [rackData, boardData] = await Promise.all([
        uploadImageForDetection(rackImage, false),
        uploadImageForDetection(boardImage, true)
      ]);

      
      // 3. Navigate to the Correction screen with BOTH sets of results
      // 4. USE ROUTER.PUSH AND STRINGIFY THE DATA
      router.push({
        pathname: '/edit',
        params: {
          rackTiles: JSON.stringify(rackData),
          boardGroups: JSON.stringify(boardData),
          rackDetectionId: rackData.data?.detectionId,
          boardDetectionId: boardData.data?.detectionId,
          rackImageUri: rackImage,
          boardImageUri: boardImage,
        }
      });

    } catch (error: any) {
      if (!(error instanceof SessionExpiredError)) {
        Alert.alert('Analysis Failed', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isReady = rackImage && boardImage;

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Start Your Move</Text>
      
      <View style={styles.uploadContainer}>
        {/* Rack Upload Slot */}
        <TouchableOpacity style={styles.card} onPress={() => showImageOptions('rack')}>
          {rackImage ? (
            <Image source={{ uri: rackImage }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="person-outline" size={40} color="#666" />
              <Text style={styles.cardText}>Upload Rack</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Board Upload Slot */}
        <TouchableOpacity style={styles.card} onPress={() => showImageOptions('board')}>
          {boardImage ? (
            <Image source={{ uri: boardImage }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="grid-outline" size={40} color="#666" />
              <Text style={styles.cardText}>Upload Board</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Continue Button */}
      <TouchableOpacity 
        style={[styles.continueButton, !isReady && styles.disabledButton]}
        disabled={!isReady || isLoading}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Continue to Analyze</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, color: '#333' },
  uploadContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  card: { 
    width: '48%', height: 180, backgroundColor: '#fff', borderRadius: 15, 
    borderWidth: 1, borderColor: '#ddd', overflow: 'hidden', elevation: 3
  },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cardText: { marginTop: 10, color: '#666', fontWeight: '500' },
  preview: { width: '100%', height: '100%' },
  continueButton: { backgroundColor: 'rgb(138, 192, 133)', padding: 18, borderRadius: 12, alignItems: 'center' },
  disabledButton: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

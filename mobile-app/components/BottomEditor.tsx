import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TileData } from '../src/types/tile';
import { EDITOR_THEME } from '../src/constants/colors';
import NumberPicker from './NumberPicker';
import ColorPicker from './ColorPicker';

interface BottomEditorProps {
  selectedTile: TileData | null;
  onNumberChange: (number: string) => void;
  onColorChange: (color: string) => void;
  onSave: () => void;
  hasChanges: boolean;
  imageUri?: string;
}

export default function BottomEditor({
  selectedTile,
  onNumberChange,
  onColorChange,
  onSave,
  hasChanges,
  imageUri,
}: BottomEditorProps) {
  const [imageModalVisible, setImageModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      {selectedTile ? (
        <View style={styles.content}>
          {/* Top: Color Picker row with image preview button on left */}
          <View style={styles.colorRow}>
            <TouchableOpacity
              style={styles.imagePreviewButton}
              onPress={() => imageUri && setImageModalVisible(true)}
              activeOpacity={imageUri ? 0.7 : 1}
            >
              <Ionicons name="image-outline" size={20} color={imageUri ? '#FFFFFF' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>

            <View style={styles.colorSection}>
              <Text style={styles.label}>Color:</Text>
              <ColorPicker onSelectColor={onColorChange} />
            </View>
          </View>

          {/* Bottom: Number Picker and Save Button */}
          <View style={styles.bottomSection}>
            <View style={styles.numberSection}>
              <Text style={styles.label}>Number:</Text>
              <NumberPicker onSelectNumber={onNumberChange} />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                !hasChanges && styles.saveButtonDisabled
              ]}
              onPress={onSave}
              disabled={!hasChanges}
              activeOpacity={0.7}
            >
              <Text style={styles.checkmark}>✓</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <TouchableOpacity
            style={styles.imagePreviewButtonAbsolute}
            onPress={() => imageUri && setImageModalVisible(true)}
            activeOpacity={imageUri ? 0.7 : 1}
          >
            <Ionicons name="image-outline" size={20} color={imageUri ? '#FFFFFF' : 'rgba(255,255,255,0.3)'} />
          </TouchableOpacity>
          <Text style={styles.placeholderText}>Tap a tile to edit</Text>
        </View>
      )}

      {/* Image Preview Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setImageModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setImageModalVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: EDITOR_THEME.pickerBackground,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  content: {
    gap: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imagePreviewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorSection: {
    flex: 1,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.82,
    height: Dimensions.get('window').height * 0.35,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  numberSection: {
    flex: 1,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  saveButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
  checkmark: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  imagePreviewButtonAbsolute: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontStyle: 'italic',
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
}

export default function BottomEditor({
  selectedTile,
  onNumberChange,
  onColorChange,
  onSave,
  hasChanges,
}: BottomEditorProps) {
  return (
    <View style={styles.container}>
      {selectedTile ? (
        <View style={styles.content}>
          {/* Top: Color Picker */}
          <View style={styles.colorSection}>
            <Text style={styles.label}>Color:</Text>
            <ColorPicker onSelectColor={onColorChange} />
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
          <Text style={styles.placeholderText}>Tap a tile to edit</Text>
        </View>
      )}
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
  colorSection: {
    alignItems: 'center',
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
    paddingVertical: 20,
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontStyle: 'italic',
  },
});

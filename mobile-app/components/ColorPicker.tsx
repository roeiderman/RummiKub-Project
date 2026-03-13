import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TILE_COLORS } from '../src/constants/colors';

interface ColorPickerProps {
  onSelectColor: (color: string) => void;
}

export default function ColorPicker({ onSelectColor }: ColorPickerProps) {
  const colors: Array<{ name: string; value: string }> = [
    { name: 'Blue', value: TILE_COLORS.Blue },
    { name: 'Red', value: TILE_COLORS.Red },
    { name: 'Black', value: TILE_COLORS.Black },
    { name: 'Orange', value: TILE_COLORS.Orange },
  ];

  return (
    <View style={styles.container}>
      {colors.map((color) => (
        <TouchableOpacity
          key={color.name}
          style={[styles.colorButton, { backgroundColor: color.value }]}
          onPress={() => onSelectColor(color.name)}
          activeOpacity={0.7}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

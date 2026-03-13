import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { EDITOR_THEME } from '../src/constants/colors';

const JOKER_BLACK = require('../assets/images/joker-black.png');

interface NumberPickerProps {
  onSelectNumber: (number: string) => void;
}

export default function NumberPicker({ onSelectNumber }: NumberPickerProps) {
  const row1 = ['1', '2', '3', '4', '5', '6', '7'];
  const row2 = ['8', '9', '10', '11', '12', '13', 'joker'];

  const renderButton = (value: string) => {
    const isJoker = value === 'joker';

    return (
      <TouchableOpacity
        key={value}
        style={[styles.button, isJoker && styles.jokerButton]}
        onPress={() => onSelectNumber(value)}
        activeOpacity={0.7}
      >
        {isJoker ? (
          <Image
            source={JOKER_BLACK}
            style={styles.jokerImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.buttonText}>
            {value}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {row1.map(renderButton)}
      </View>
      <View style={styles.row}>
        {row2.map(renderButton)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    backgroundColor: EDITOR_THEME.buttonGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jokerButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  jokerImage: {
    width: 28,
    height: 28,
  },
});

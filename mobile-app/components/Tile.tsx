import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { TileData } from '../src/types/tile';
import { TILE_COLORS, EDITOR_THEME } from '../src/constants/colors';

// Import joker images statically (required by React Native bundler)
const JOKER_RED = require('../assets/images/joker-red.png');
const JOKER_BLACK = require('../assets/images/joker-black.png');

interface TileProps {
  tile: TileData;
  isSelected?: boolean;
  onPress?: () => void;
}

export default function Tile({ tile, isSelected = false, onPress }: TileProps) {
  const isJoker = tile.number === '0' || tile.number === 'joker' || tile.tile === 'Joker';
  const tileColor = TILE_COLORS[tile.color as keyof typeof TILE_COLORS] || TILE_COLORS.Black;

  const jokerImageSource = isJoker
    ? tile.color === 'Black' ? JOKER_BLACK : JOKER_RED
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.container,
        isSelected && styles.selected
      ]}
    >
      <View style={styles.tile}>
        {isJoker ? (
          <Image
            source={jokerImageSource}
            style={styles.jokerImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={[styles.number, { color: tileColor }]}>
            {tile.number}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 90,
    borderRadius: 8,
    backgroundColor: EDITOR_THEME.tileBackground,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selected: {
    borderColor: EDITOR_THEME.selectedBorder,
    borderWidth: 3,
  },
  tile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  number: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  jokerImage: {
    width: 50,
    height: 70,
  },
});

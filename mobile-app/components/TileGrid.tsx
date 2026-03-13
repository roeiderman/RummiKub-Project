import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TileData } from '../src/types/tile';
import Tile from './Tile';

interface TileGridProps {
  tiles: TileData[];
  selectedIdx: number | null;
  onSelectTile: (idx: number) => void;
}

export default function TileGrid({ tiles, selectedIdx, onSelectTile }: TileGridProps) {
  return (
    <View style={styles.container}>
      {tiles.map((tile, idx) => {
        const isSelected = selectedIdx === idx;

        return (
          <View key={tile.id} style={styles.tileWrapper}>
            <Tile
              tile={tile}
              isSelected={isSelected}
              onPress={() => onSelectTile(idx)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,  // More spacing than groups
    padding: 16,
  },
  tileWrapper: {
    // Tiles have spacing via gap
  },
});

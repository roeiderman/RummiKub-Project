import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TileData, TilePosition } from '../src/types/tile';
import Tile from './Tile';

interface TileGroupProps {
  tiles: TileData[];
  groupIdx: number;
  selectedPos: TilePosition | null;
  onSelectTile: (pos: TilePosition) => void;
}

export default function TileGroup({ tiles, groupIdx, selectedPos, onSelectTile }: TileGroupProps) {
  return (
    <View style={styles.groupContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tiles.map((tile, tileIdx) => {
          const isSelected =
            selectedPos !== null &&
            selectedPos.groupIdx === groupIdx &&
            selectedPos.tileIdx === tileIdx;

          return (
            <View key={tile.id} style={styles.tileWrapper}>
              <Tile
                tile={tile}
                isSelected={isSelected}
                onPress={() => onSelectTile({ groupIdx, tileIdx })}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  groupContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 8,
    marginVertical: 6,
  },
  scrollContent: {
    gap: 4,  // Tight spacing between tiles in a group
  },
  tileWrapper: {
    // No additional spacing, tiles are adjacent
  },
});

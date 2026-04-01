import React, { useState, useEffect, useMemo, use} from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TileData, DetectionResponse } from '../types/tile';
import { EDITOR_THEME } from '../constants/colors';
import TileGrid from '../../components/TileGrid';
import BottomEditor from '../../components/BottomEditor';

export default function EditRackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const originalTiles = useMemo(() => {
    try {
      if (!params.originalTiles) return [];
      return JSON.parse(params.originalTiles as string).data.rack as TileData[];
    } catch (error) {
      console.error("Failed to parse original history:", error);
      return [];
    }
  }, [params.originalTiles]);

  useEffect(() => {
    try {
      if (params.rackTiles) {
        const data: DetectionResponse = JSON.parse(params.rackTiles as string);
        if (data.data.rack) {
          setTiles(data.data.rack);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load rack data');
      console.error('Failed to parse rack tiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params.rackTiles]);

  useEffect (() => {
      setHasChanges(tilesChanged(originalTiles, tiles));
  }, [tiles]);

  const tilesChanged = (original: TileData[], current: TileData[]): boolean => {
    if (original.length !== current.length) return true;
    return original.some((orig, i) =>
      orig.color !== current[i].color || String(orig.number) !== String(current[i].number)
    );
  };

  const handleSelectTile = (idx: number) => {
    setSelectedIdx(idx);
  };

  const handleNumberChange = (number: string) => {
    if (selectedIdx === null) return;

    const newTiles = [...tiles];
    const tile = newTiles[selectedIdx];

    // Update number
    tile.number = number === 'joker' ? '0' : number;

    // Update tile string
    if (number === 'joker') {
      tile.tile = 'Joker';
    } else {
      tile.tile = `${tile.color}_${number}`;
    }

    setTiles(newTiles);
  };

  const handleColorChange = (color: string) => {
    if (selectedIdx === null) return;

    const newTiles = [...tiles];
    const tile = newTiles[selectedIdx];

    // Update color
    tile.color = color as "Blue" | "Red" | "Black" | "Orange";

    // Update tile string (unless it's a joker)
    if (tile.number !== '0' && tile.number !== 'joker' && tile.tile !== 'Joker') {
      tile.tile = `${color}_${tile.number}`;
    }

    setTiles(newTiles);
  };

  const handleSave = () => {
    Alert.alert('Success', 'Rack tiles updated successfully!');
  };

  const handleBackPress = () => {
    // Validate joker colors - must be Red or Black only
    const invalidJokers = tiles.filter(tile => {
      const isJoker = tile.number === '0' || tile.number === 'joker' || tile.tile === 'Joker';
      return isJoker && tile.color !== 'Red' && tile.color !== 'Black';
    });

    if (invalidJokers.length > 0) {
      const invalidColors = invalidJokers.map(t => t.color).join(', ');
      Alert.alert(
        'Invalid Joker Color',
        `Jokers can only be Red or Black.\n\nYou have joker(s) with invalid color(s): ${invalidColors}\n\nPlease fix the joker colors before going back.`,
        [{ text: 'OK' }]
      );
      return; // Don't navigate back
    }

    // Create updated detection response with modified tiles
    const updatedRackData = {
      success: true,
      data: {
        rack: tiles,
        numTilesDetected: tiles.length,
        imageWidth: JSON.parse(params.rackTiles as string).data.imageWidth,
        imageHeight: JSON.parse(params.rackTiles as string).data.imageHeight,
      },
      message: `Detected ${tiles.length} tiles`,
    };

    // Print the updated rack JSON
    console.log('=== UPDATED RACK JSON ===');
    console.log(JSON.stringify(updatedRackData, null, 2));
    console.log('=========================');

    // Navigate back with visited flag, updated data, and whether edits were made
    router.navigate({
      pathname: '/edit',
      params: {
        boardGroups: params.boardGroups,
        rackTiles: JSON.stringify(updatedRackData),
        rackVisited: 'true',
        boardVisited: params.boardVisited || undefined,
        rackDetectionId: params.rackDetectionId,
        boardDetectionId: params.boardDetectionId,
        rackWasEdited: hasChanges ? 'true' : 'false',
        boardWasEdited: params.boardWasEdited,
        originalTiles: params.originalTiles,
        originalBoard: params.originalBoard,
        rackImageUri: params.rackImageUri,
        boardImageUri: params.boardImageUri,
      },
    });
  };

  const selectedTile = selectedIdx !== null ? tiles[selectedIdx] : null;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleButton}>
          <Text style={styles.title}>Edit your rack</Text>
        </View>

        {/* Spacer for centering */}
        <View style={styles.backButton} />
      </View>

      {/* Tiles Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {tiles.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No tiles detected</Text>
          </View>
        ) : (
          <TileGrid
            tiles={tiles}
            selectedIdx={selectedIdx}
            onSelectTile={handleSelectTile}
          />
        )}
        {/* Add padding at bottom for BottomEditor */}
        <View style={{ height: 220 }} />
      </ScrollView>

      {/* Bottom Editor */}
      <BottomEditor
        selectedTile={selectedTile}
        onNumberChange={handleNumberChange}
        onColorChange={handleColorChange}
        onSave={handleSave}
        hasChanges={hasChanges}
        imageUri={params.rackImageUri as string | undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: EDITOR_THEME.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleButton: {
    backgroundColor: 'rgba(200, 184, 168, 0.6)',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
});

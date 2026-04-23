import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TileData, TilePosition, DetectionResponse } from '../types/tile';
import { EDITOR_THEME } from '../constants/colors';
import TileGroup from '../../components/TileGroup';
import BottomEditor from '../../components/BottomEditor';

export default function EditBoardScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [groups, setGroups] = useState<TileData[][]>([]);
  const [selectedPos, setSelectedPos] = useState<TilePosition | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const originalBoard = useMemo(() => {
    try {
      if (!params.originalBoard) return [];
      return (JSON.parse(params.originalBoard as string).data?.groups ?? []) as TileData[][];
    } catch (error) {
      console.error("Failed to parse original history:", error);
      return [];
    }
  }, [params.originalBoard]);

  useEffect(() => {
    try {
      if (params.boardGroups) {
        const data: DetectionResponse = JSON.parse(params.boardGroups as string);
        if (data.data.groups) {
          setGroups(data.data.groups);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load board data');
      console.error('Failed to parse board groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params.boardGroups]);

  const tilesChanged = (original: TileData[], current: TileData[]): boolean => {
    if (original.length !== current.length) return true;
    return original.some((orig, i) =>
      orig.color !== current[i].color || String(orig.number) !== String(current[i].number)
    );
  };

    useEffect (() => {
        setHasChanges(tilesChanged(originalBoard.flat(), groups.flat()));
    }, [groups]);

  const handleSelectTile = (pos: TilePosition) => {
    setSelectedPos(pos);
  };

  const handleNumberChange = (number: string) => {
    if (selectedPos === null) return;

    const newGroups = [...groups];
    const tile = newGroups[selectedPos.groupIdx][selectedPos.tileIdx];
    const nextIsJoker = number === 'joker';
    const jokerColor = tile.color === 'Black' ? 'Black' : 'Red';

    // Keep edited jokers in the same shape as model-detected jokers.
    tile.number = nextIsJoker ? null : number;
    tile.isJoker = nextIsJoker;

    if (nextIsJoker) {
      tile.color = jokerColor;
      tile.tile = `${jokerColor}_Joker`;
    } else {
      tile.tile = `${tile.color}_${number}`;
    }

    setGroups(newGroups);
  };

  const handleColorChange = (color: string) => {
    if (selectedPos === null) return;

    const newGroups = [...groups];
    const tile = newGroups[selectedPos.groupIdx][selectedPos.tileIdx];
    const isJoker = tile.isJoker || (tile.tile != null && tile.tile.toLowerCase().includes('joker'));

    if (isJoker && color !== 'Red' && color !== 'Black') {
      Alert.alert(
        'Invalid Joker Color',
        'Jokers can only be Red or Black.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Update color
    tile.color = color as "Blue" | "Red" | "Black" | "Orange";

    if (isJoker) {
      tile.tile = `${color}_Joker`;
      tile.number = null;
      tile.isJoker = true;
    } else {
      tile.tile = `${color}_${tile.number}`;
    }

    setGroups(newGroups);
  };

  const handleSave = () => {
    Alert.alert('Success', 'Board tiles updated successfully!');
  };

  const handleBackPress = () => {
    // Validate joker colors - must be Red or Black only
    const allTiles = groups.flat();
    const invalidJokers = allTiles.filter(tile => {
      const isJoker = tile.isJoker || (tile.tile != null && tile.tile.toLowerCase().includes('joker'));
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

    // Create updated detection response with modified groups
    const updatedBoardData = {
      success: true,
      data: {
        groups: groups,
        numTilesDetected: groups.flat().length,
        numSeriesDetected: groups.length,
        imageWidth: JSON.parse(params.boardGroups as string).data.imageWidth,
        imageHeight: JSON.parse(params.boardGroups as string).data.imageHeight,
      },
      message: `Detected ${groups.flat().length} tiles and ${groups.length} series`,
    };

    // Navigate back with visited flag, updated data, and whether edits were made
    router.navigate({
      pathname: '/edit',
      params: {
        boardGroups: JSON.stringify(updatedBoardData),
        rackTiles: params.rackTiles,
        boardVisited: 'true',
        rackVisited: params.rackVisited || undefined,
        boardDetectionId: params.boardDetectionId,
        rackDetectionId: params.rackDetectionId,
        boardWasEdited: hasChanges ? 'true' : 'false',
        rackWasEdited: params.rackWasEdited,
        originalTiles: params.originalTiles,
        originalBoard: params.originalBoard,
        rackImageUri: params.rackImageUri,
        boardImageUri: params.boardImageUri,
      },
    });
  };

  const selectedTile = selectedPos !== null
    ? groups[selectedPos.groupIdx]?.[selectedPos.tileIdx]
    : null;

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
          <Text style={styles.title}>Edit board</Text>
        </View>

        {/* Spacer for centering */}
        <View style={styles.backButton} />
      </View>

      {/* Groups ScrollView */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {groups.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No groups detected</Text>
          </View>
        ) : (
          groups.map((group, groupIdx) => (
            <TileGroup
              key={groupIdx}
              tiles={group}
              groupIdx={groupIdx}
              selectedPos={selectedPos}
              onSelectTile={handleSelectTile}
            />
          ))
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
        imageUri={params.boardImageUri as string | undefined}
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
    padding: 16,
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

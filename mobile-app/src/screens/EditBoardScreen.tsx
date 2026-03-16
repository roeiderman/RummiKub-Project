import React, { useState, useEffect } from 'react';
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

  const handleSelectTile = (pos: TilePosition) => {
    setSelectedPos(pos);
  };

  const handleNumberChange = (number: string) => {
    if (selectedPos === null) return;

    const newGroups = [...groups];
    const tile = newGroups[selectedPos.groupIdx][selectedPos.tileIdx];

    // Update number
    tile.number = number === 'joker' ? '0' : number;

    // Update tile string
    if (number === 'joker') {
      tile.tile = 'Joker';
    } else {
      tile.tile = `${tile.color}_${number}`;
    }

    setGroups(newGroups);
    setHasChanges(true);
  };

  const handleColorChange = (color: string) => {
    if (selectedPos === null) return;

    const newGroups = [...groups];
    const tile = newGroups[selectedPos.groupIdx][selectedPos.tileIdx];

    // Update color
    tile.color = color as "Blue" | "Red" | "Black" | "Orange";

    // Update tile string (unless it's a joker)
    if (tile.number !== '0' && tile.number !== 'joker' && tile.tile !== 'Joker') {
      tile.tile = `${color}_${tile.number}`;
    }

    setGroups(newGroups);
    setHasChanges(true);
  };

  const handleSave = () => {
    Alert.alert('Success', 'Board tiles updated successfully!');
    setHasChanges(false);
  };

  const handleBackPress = () => {
    // Validate joker colors - must be Red or Black only
    const allTiles = groups.flat();
    const invalidJokers = allTiles.filter(tile => {
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

    // Print the updated board JSON
    console.log('=== UPDATED BOARD JSON ===');
    console.log(JSON.stringify(updatedBoardData, null, 2));
    console.log('==========================');

    // Navigate back with visited flag and updated data
    router.push({
      pathname: '/edit',
      params: {
        boardGroups: JSON.stringify(updatedBoardData),
        rackTiles: params.rackTiles,
        boardVisited: 'true',
        rackVisited: params.rackVisited || undefined,
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

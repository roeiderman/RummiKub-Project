import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { EDITOR_THEME } from '../src/constants/colors';
import { findOptimalMove } from '../src/services/optimizeService';
import { DetectionResponse } from '../src/types/tile';

export default function EditChooserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [visitedBoard, setVisitedBoard] = useState(false);
  const [visitedRack, setVisitedRack] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Check if user is returning from edit screens
  useFocusEffect(
    React.useCallback(() => {
      if (params.boardVisited === 'true') {
        setVisitedBoard(true);
      }
      if (params.rackVisited === 'true') {
        setVisitedRack(true);
      }
    }, [params.boardVisited, params.rackVisited])
  );

  const canFindBestMove = visitedBoard && visitedRack;

  const handleFindBestMove = async () => {
    try {
      setIsOptimizing(true);

      // Parse the data
      const boardData: DetectionResponse = JSON.parse(params.boardGroups as string);
      const rackData: DetectionResponse = JSON.parse(params.rackTiles as string);

      const groups = boardData.data.groups || [];
      const rack = rackData.data.rack || [];

      console.log('=== SENDING TO OPTIMIZE API ===');
      console.log('Groups count:', groups.length);
      console.log('Rack tiles count:', rack.length);
      if (groups.length > 0) {
        console.log('First group:', JSON.stringify(groups[0], null, 2));
      }
      if (rack.length > 0) {
        console.log('First rack tile:', JSON.stringify(rack[0], null, 2));
      }
      console.log('================================');

      // Validate we have data
      if (groups.length === 0 && rack.length === 0) {
        Alert.alert(
          'No Data',
          'No tiles detected. Please upload images again.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (rack.length === 0) {
        Alert.alert(
          'No Rack Tiles',
          'You need tiles in your rack to find a move.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Call optimize API
      const result = await findOptimalMove(groups, rack);

      // Show results
      if (result.data.tilesPlayed === 0) {
        Alert.alert(
          'No Move Found',
          'No valid moves available with your current tiles.',
          [{ text: 'OK' }]
        );
      } else {
        const { optimalMove, tilesPlayed, updatedGroups, remainingRack } = result.data;

        // Format the move description
        let moveDescription = '';
        if (optimalMove.moveType === 'extend') {
          moveDescription = `Extend group ${(optimalMove.seriesIndex || 0) + 1} with ${tilesPlayed} tile(s)`;
        } else {
          moveDescription = `Create new ${optimalMove.seriesType} with ${tilesPlayed} tile(s)`;
        }

        // Show tiles used
        const tilesUsedText = optimalMove.tilesUsed
          .map(t => t.tile)
          .join(', ');

        Alert.alert(
          '🎯 Optimal Move Found!',
          `${moveDescription}\n\nTiles to play: ${tilesUsedText}\n\nTiles played: ${tilesPlayed}`,
          [
            {
              text: 'View Details',
              onPress: () => {
                console.log('=== OPTIMAL MOVE DETAILS ===');
                console.log(JSON.stringify(result.data, null, 2));
                console.log('============================');
              },
            },
            { text: 'OK' },
          ]
        );
      }
    } catch (error: any) {
      // Handle board validation errors specially
      if (error.type === 'BoardInvalidError' && error.invalidGroups) {
        setIsOptimizing(false); // Stop loading for the alert

        const invalidCount = error.invalidGroups.length;
        let errorSummary = `Found ${invalidCount} invalid group(s):\n\n`;

        // Show first 3 invalid groups
        error.invalidGroups.slice(0, 3).forEach((group: any) => {
          errorSummary += `• Group ${group.groupIndex + 1}: ${group.reason}\n`;
          errorSummary += `  (${group.tiles.join(', ')})\n\n`;
        });

        if (invalidCount > 3) {
          errorSummary += `...and ${invalidCount - 3} more invalid group(s).\n\n`;
        }

        errorSummary += 'Each group needs:\n• At least 3 tiles\n• Valid run (same color, consecutive numbers)\n  OR valid set (same number, different colors)';

        Alert.alert(
          '⚠️ Invalid Board Configuration',
          errorSummary,
          [
            {
              text: 'Fix Board Groups',
              onPress: () => {
                router.push({
                  pathname: '/edit-board',
                  params: {
                    boardGroups: params.boardGroups,
                    rackTiles: params.rackTiles,
                    rackVisited: visitedRack ? 'true' : undefined,
                  },
                });
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return; // Don't execute finally block
      } else {
        // General error
        Alert.alert(
          '❌ Optimization Error',
          error.message || 'Failed to find optimal move. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Your Tiles</Text>
        <Text style={styles.subtitle}>Choose what to edit</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            !visitedBoard && styles.buttonUnvisited,
            visitedBoard && styles.buttonVisited
          ]}
          onPress={() =>
            router.push({
              pathname: '/edit-board',
              params: {
                boardGroups: params.boardGroups,
                rackTiles: params.rackTiles,
                rackVisited: visitedRack ? 'true' : undefined,
              },
            })
          }
          activeOpacity={0.7}
        >
          {visitedBoard && (
            <View style={styles.checkmarkBadge}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
          {!visitedBoard && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>!</Text>
            </View>
          )}
          <Text style={styles.buttonEmoji}>🎯</Text>
          <Text style={styles.buttonText}>Edit Board</Text>
          <Text style={styles.buttonSubtext}>
            {visitedBoard ? 'Reviewed ✓' : 'Required - Tap to review'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            !visitedRack && styles.buttonUnvisited,
            visitedRack && styles.buttonVisited
          ]}
          onPress={() =>
            router.push({
              pathname: '/edit-rack',
              params: {
                rackTiles: params.rackTiles,
                boardGroups: params.boardGroups,
                boardVisited: visitedBoard ? 'true' : undefined,
              },
            })
          }
          activeOpacity={0.7}
        >
          {visitedRack && (
            <View style={styles.checkmarkBadge}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
          {!visitedRack && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>!</Text>
            </View>
          )}
          <Text style={styles.buttonEmoji}>🎴</Text>
          <Text style={styles.buttonText}>Edit Rack</Text>
          <Text style={styles.buttonSubtext}>
            {visitedRack ? 'Reviewed ✓' : 'Required - Tap to review'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Find Best Move Button */}
      {canFindBestMove && (
        <TouchableOpacity
          style={[styles.findMoveButton, isOptimizing && styles.findMoveButtonDisabled]}
          onPress={handleFindBestMove}
          disabled={isOptimizing}
          activeOpacity={0.8}
        >
          {isOptimizing ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.findMoveText}>Finding Best Move...</Text>
            </>
          ) : (
            <>
              <Text style={styles.findMoveEmoji}>🧠</Text>
              <Text style={styles.findMoveText}>Find Your Best Move</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: EDITOR_THEME.background,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  buttonsContainer: {
    gap: 20,
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  buttonUnvisited: {
    borderColor: '#F44336',
    borderWidth: 3,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  buttonVisited: {
    borderColor: '#4CAF50',
    borderWidth: 3,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requiredBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#F44336',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requiredText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  buttonEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  findMoveButton: {
    marginTop: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    padding: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  findMoveButtonDisabled: {
    backgroundColor: '#9E9E9E',
    opacity: 0.7,
  },
  findMoveEmoji: {
    fontSize: 32,
  },
  findMoveText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
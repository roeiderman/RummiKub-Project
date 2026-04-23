import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { EDITOR_THEME } from '../src/constants/colors';
import { findOptimalMove } from '../src/services/optimizeService';
import { recordTurn } from '../src/services/leaderboardService';
import { DetectionResponse, TileData, RummikubTile } from '../src/types/tile';
import { SessionExpiredError } from '../src/services/apiClient';
import { submitCorrection, deleteTrainingImage } from '../src/services/trainingService';

export default function EditChooserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [visitedBoard, setVisitedBoard] = useState(false);
  const [visitedRack, setVisitedRack] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const originalTiles = useRef(params.originalTiles || params.rackTiles);
  const originalBoard = useRef(params.originalBoard || params.boardGroups);

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

  const sanitizeTile = (tile: TileData): RummikubTile => {
    const { position, size, corners, rotation_degrees, confidence, ...cleanTile } = tile;
    return cleanTile;
  };

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
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upload New Images', onPress: () => router.replace('/home') },
          ]
        );
        return;
      }

      if (rack.length === 0) {
        Alert.alert(
          'No Rack Tiles',
          'You need tiles in your rack to find a move.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upload New Images', onPress: () => router.replace('/home') },
          ]
        );
        return;
      }

      // Validate joker counts across board + rack (max 1 red joker, 1 black joker)
      const isJoker = (tile: TileData) =>
        tile.tile?.includes('Joker') || (tile.isJoker === true && tile.number === null);
      const allTiles = [...groups.flat(), ...rack];
      const redJokers   = allTiles.filter(t => isJoker(t) && t.color === 'Red');
      const blackJokers = allTiles.filter(t => isJoker(t) && t.color === 'Black');

      if (redJokers.length > 1 || blackJokers.length > 1) {
        setIsOptimizing(false);
        let jokerError = '';
        if (redJokers.length > 1)   jokerError += `• ${redJokers.length} Red jokers found (max 1)\n`;
        if (blackJokers.length > 1) jokerError += `• ${blackJokers.length} Black jokers found (max 1)\n`;

        Alert.alert(
          'Invalid Joker Count',
          `There can only be 1 Red joker and 1 Black joker in the game.\n\n${jokerError}\nPlease fix the joker tiles before continuing.`,
          [
            {
              text: 'Fix Board',
              onPress: () => router.push({
                pathname: '/edit-board',
                params: {
                  boardGroups: params.boardGroups,
                  rackTiles: params.rackTiles,
                  rackVisited: visitedRack ? 'true' : undefined,
                  boardDetectionId: params.boardDetectionId,
                  rackDetectionId: params.rackDetectionId,
                  originalTiles: originalTiles.current,
                  originalBoard: originalBoard.current,
                },
              }),
            },
            {
              text: 'Fix Rack',
              onPress: () => router.push({
                pathname: '/edit-rack',
                params: {
                  rackTiles: params.rackTiles,
                  boardGroups: params.boardGroups,
                  boardVisited: visitedBoard ? 'true' : undefined,
                  rackDetectionId: params.rackDetectionId,
                  boardDetectionId: params.boardDetectionId,
                  originalTiles: originalTiles.current,
                  originalBoard: originalBoard.current,
                },
              }),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      const cleanGroups: RummikubTile[][] = groups.map(group => group.map(sanitizeTile));

      // Clean the 1D array of the rack
      const cleanRack: RummikubTile[] = rack.map(sanitizeTile);

      // Call optimize API — BoardInvalidError throws here if board is invalid
      const result = await findOptimalMove(cleanGroups, cleanRack);

      // Board is valid — safe to submit training corrections (fire-and-forget)
      if (params.rackWasEdited === 'true' && params.rackDetectionId) {
        submitCorrection({
          detectionId: params.rackDetectionId as string,
          isRack: true,
          correctedTiles: rack,
          imageWidth: rackData.data.imageWidth,
          imageHeight: rackData.data.imageHeight,
        });
      }
      if (params.boardWasEdited === 'true' && params.boardDetectionId) {
        submitCorrection({
          detectionId: params.boardDetectionId as string,
          isRack: false,
          correctedTiles: groups.flat(),
          imageWidth: boardData.data.imageWidth,
          imageHeight: boardData.data.imageHeight,
        });
      }

      // Delete local images that weren't edited (no HF upload needed for unchanged detections)
      if (params.rackWasEdited !== 'true' && params.rackDetectionId)
        deleteTrainingImage(params.rackDetectionId as string);
      if (params.boardWasEdited !== 'true' && params.boardDetectionId)
        deleteTrainingImage(params.boardDetectionId as string);

      // Show results
      const optimizeData = result.data as any;
      const hasMoves = Array.isArray(optimizeData?.moves) && optimizeData.moves.length > 0;
      const noMovesFound =
        !optimizeData?.success ||
        optimizeData?.noMoves === true ||
        !hasMoves;

      if (noMovesFound) {
        recordTurn(0).catch(() => {});
        Alert.alert(
          'No Move Found',
          result?.message || 'No valid moves available with your current tiles.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upload New Images', onPress: () => router.replace('/home') },
          ]
        );
      } else {
        const tilesUsed: number = optimizeData.tilesUsed ?? 0;

        // Record turn in leaderboard
        recordTurn(tilesUsed).catch(() => {});

        // 🚀 INSTANTLY navigate to the solution screen
        router.push({
          pathname: '/solution-screen', // Make sure this matches your file name exactly
          params: {
            moves: JSON.stringify(optimizeData.moves),
            // CRITICAL: Pass the starting arrays so the screen knows where the tiles begin!
            boardGroups: JSON.stringify(cleanGroups), 
            rackTiles: JSON.stringify(cleanRack),
            finalBoard: JSON.stringify(optimizeData.finalBoard)
          }
        });
      }
    } catch (error: any) {
      if (error instanceof SessionExpiredError) {
        return; // _onSessionExpired handler already redirected to login
      }
      // Handle board validation errors specially
      if (error.type === 'BoardInvalidError' && error.invalidGroups) {
        // Delete local training images — invalid board data is not useful for training
        if (params.rackDetectionId) deleteTrainingImage(params.rackDetectionId as string);
        if (params.boardDetectionId) deleteTrainingImage(params.boardDetectionId as string);

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
          'Invalid Board Configuration',
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
            { text: 'Upload New Images', onPress: () => router.replace('/home') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return; // Don't execute finally block
      } else {
        // General error
        Alert.alert(
          'Optimization Error',
          error.message || 'Failed to find optimal move. Please try again.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upload New Images', onPress: () => router.replace('/home') },
          ]
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
            !visitedRack && styles.buttonUnvisited,
            visitedRack && styles.buttonVisited,
            isOptimizing && styles.buttonDisabled,
          ]}
          disabled={isOptimizing}
          onPress={() =>
            router.push({
              pathname: '/edit-rack',
              params: {
                rackTiles: params.rackTiles,
                boardGroups: params.boardGroups,
                boardVisited: visitedBoard ? 'true' : undefined,
                rackDetectionId: params.rackDetectionId,
                boardDetectionId: params.boardDetectionId,
                boardWasEdited: params.boardWasEdited,
                originalTiles: originalTiles.current,
                originalBoard: originalBoard.current,
                rackImageUri: params.rackImageUri,
                boardImageUri: params.boardImageUri,
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
          <Text style={styles.buttonText}>Edit Rack</Text>
          <Text style={styles.buttonSubtext}>
            {visitedRack ? 'Reviewed' : 'Required - Tap to review'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            !visitedBoard && styles.buttonUnvisited,
            visitedBoard && styles.buttonVisited,
            isOptimizing && styles.buttonDisabled,
          ]}
          disabled={isOptimizing}
          onPress={() =>
            router.push({
              pathname: '/edit-board',
              params: {
                boardGroups: params.boardGroups,
                rackTiles: params.rackTiles,
                rackVisited: visitedRack ? 'true' : undefined,
                boardDetectionId: params.boardDetectionId,
                rackDetectionId: params.rackDetectionId,
                rackWasEdited: params.rackWasEdited,
                originalTiles: originalTiles.current,
                originalBoard: originalBoard.current,
                rackImageUri: params.rackImageUri,
                boardImageUri: params.boardImageUri,
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
          <Text style={styles.buttonText}>Edit Board</Text>
          <Text style={styles.buttonSubtext}>
            {visitedBoard ? 'Reviewed' : 'Required - Tap to review'}
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
  buttonDisabled: {
    opacity: 0.4,
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

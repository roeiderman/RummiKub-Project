import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { RummikubTile, RummikubMove } from '../src/types/tile'
import { TILE_COLORS } from '../src/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ADD THIS HELPER FUNCTION
export const getTileKey = (tile: RummikubTile) => `${tile._source}_${tile.id}`;

export const applyMoveToState = (
  move: RummikubMove,
  currentBoard: RummikubTile[][], 
  currentRack: RummikubTile[]
) => {
  // Use the unique composite key instead of just the ID
  const movingTileKeys = move.tiles.map(getTileKey);

  // Filter out the moving tiles using the new key
  const nextRack = currentRack.filter(tile => !movingTileKeys.includes(getTileKey(tile)));

  let nextBoard = currentBoard.map(group => 
    group.filter(tile => !movingTileKeys.includes(getTileKey(tile)))
  );

  nextBoard.push(move.tiles);
  nextBoard = nextBoard.filter(group => group.length > 0);

  return { newBoard: nextBoard, newRack: nextRack };
};

export default function AnimatedSolutionScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const safeParse = (data: any) => {
    try { return JSON.parse(data as string); } 
    catch { return []; }
  };

  const moves: RummikubMove[] = safeParse(params.moves);
  const rawBoard: RummikubTile[][] = safeParse(params.boardGroups);
  const rawRack: RummikubTile[] = safeParse(params.rackTiles);

  // 2. FORCE THE SOURCE TAGS ONTO THE RAW DATA
  const initialBoard = rawBoard.map(group => 
    group.map(tile => ({ ...tile, _source: 'board' as const }))
  );
  
  const initialRack = rawRack.map(tile => 
    ({ ...tile, _source: 'rack' as const })
  );

  // 3. Load the stamped arrays into your state machine
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visualBoard, setVisualBoard] = useState<RummikubTile[][]>(initialBoard);
  const [visualRack, setVisualRack] = useState<RummikubTile[]>(initialRack);

  // 1. IDENTIFY ACTIVE TILES USING THE COMPOSITE KEY
  const currentMove = currentStepIndex < moves.length ? moves[currentStepIndex] : null;
  const activeTileKeys = currentMove ? currentMove.tiles.map(getTileKey) : [];
 
  const AnimatedTile = ({ tile, isActive }: { tile: RummikubTile; isActive: boolean }) => {
    const tileStateStyle = !currentMove 
      ? null 
      : isActive
        ? styles.activeTile 
        : null;

    return ( 
      <Animated.View 
        layout={LinearTransition.springify().damping(14)}
        entering={FadeIn}
        exiting={FadeOut}
      >
        <View style={[styles.tileBox, tileStateStyle]}>
          <Text style={[styles.tileText, { color: TILE_COLORS[tile.color as keyof typeof TILE_COLORS] || TILE_COLORS.Black }]}>
            {tile.isJoker ? '🃏' : tile.number}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const handleNextStep = () => {
    if (currentStepIndex >= moves.length) return;
    
    const { newBoard, newRack } = applyMoveToState(currentMove!, visualBoard, visualRack);
    
    setVisualBoard(newBoard);
    setVisualRack(newRack);
    setCurrentStepIndex(prev => prev + 1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView style={styles.boardArea} contentContainerStyle={styles.boardContent}>
        {visualBoard.map((group, groupIndex) => (
          <Animated.View 
            key={`group-${groupIndex}`} 
            layout={LinearTransition}
            style={styles.groupContainer}
          >
            {group.map(tile => (
              <AnimatedTile 
                // CRITICAL: Use the unique composite key for the React Key!
                key={getTileKey(tile)} 
                tile={tile}
                isActive={activeTileKeys.includes(getTileKey(tile))}
              />
            ))}
          </Animated.View>
        ))}
      </ScrollView>

      {/* ... (Instruction area stays exactly the same) ... */}
      <View style={styles.instructionArea}>
        {currentMove ? (
          <>
            <Text style={styles.stepCounter}>Step {currentStepIndex + 1} of {moves.length}</Text>
            <Text style={styles.instructionText}>{currentMove.description}</Text>
            <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
              <Text style={styles.nextButtonText}>Animate Next Move</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.successText}>Board Complete! 🎉</Text>
        )}
      </View>

      <View style={styles.rackArea}>
        <Text style={styles.rackTitle}>Your Rack</Text>
        <View style={styles.rackContainer}>
          {visualRack.map(tile => (
            <AnimatedTile 
              // CRITICAL: Use the unique composite key here too
              key={getTileKey(tile)} 
              tile={tile} 
              isActive={activeTileKeys.includes(getTileKey(tile))}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// (Keep all your existing StyleSheet code exactly as it is!)

const styles = StyleSheet.create({
  // --- MAIN LAYOUT ---
  container: { 
    flex: 1, 
    padding: 16, 
    backgroundColor: '#f8f9fa' 
  },

  // --- TOP: BOARD AREA ---
  boardArea: {
    flex: 1, // Takes up the remaining vertical space
    marginBottom: 16,
  },
  boardContent: {
    flexDirection: 'row', // Aligns groups horizontally
    flexWrap: 'wrap',     // Forces groups to wrap to the next line if they don't fit
    alignItems: 'flex-start',
    gap: 12,              // Creates the "grid" spacing between groups
    paddingBottom: 20,    // Adds a little padding at the very bottom of the scroll
  },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 3,
    borderRadius: 12,
    margin: 3,
  },

  // --- MIDDLE: INSTRUCTION AREA ---
  instructionArea: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 5, 
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF', // Blue accent to draw attention
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  instructionText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#34c759', // Success Green
    textAlign: 'center',
    paddingVertical: 10,
  },

  // --- BOTTOM: RACK AREA ---
  rackArea: {
    backgroundColor: '#e9ecef', // Slightly darker to differentiate from the board
    padding: 16,
    borderRadius: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  rackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  rackContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center', // Centers the tiles in your hand
  },

  // --- TILES ---
  tileBox: { 
    width: 42, 
    height: 56, // Slightly taller to look more like a real Rummikub tile
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#cfd4da', 
    borderRadius: 8,
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOpacity: 0.15, 
    shadowRadius: 2, 
    elevation: 2
  },
  tileText: { 
    fontSize: 22, 
    fontWeight: '900', // Extra bold for readability 
  },
  rackBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    width: 14, 
    height: 14, 
    backgroundColor: '#34c759', 
    borderRadius: 7, 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  activeTile: {
    borderColor: '#007AFF', // Bright blue border to indicate it's selected
    borderWidth: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }], // Slightly pop the tile out
    zIndex: 10, // Ensure it sits above other tiles visually
  }
});
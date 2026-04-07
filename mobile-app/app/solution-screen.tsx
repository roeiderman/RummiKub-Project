import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  ScrollViewComponent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TILE_COLORS } from '../src/constants/colors';
import { RummikubMove, RummikubTile } from '../src/types/tile';

const JOKER_RED = require('../assets/images/joker-red.png');
const JOKER_BLACK = require('../assets/images/joker-black.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const getTileKey = (tile: RummikubTile) => `${tile._source}_${tile.id}`;

export const applyMoveToState = (
  move: RummikubMove,
  currentBoard: RummikubTile[][],
  currentNewBoard: RummikubTile[][],
  currentRack: RummikubTile[]
) => {
  const movingTileKeys = move.tiles.map(getTileKey);

  const nextRack = currentRack.filter(tile => !movingTileKeys.includes(getTileKey(tile)));

  const nextBoard = currentBoard
    .map(group => group.filter(tile => !movingTileKeys.includes(getTileKey(tile))))
    .filter(group => group.length > 0);

  const nextNewBoard = currentNewBoard
    .map(group => group.filter(tile => !movingTileKeys.includes(getTileKey(tile))))
    .filter(group => group.length > 0);

  nextNewBoard.push(move.tiles);

  return { newBoard: nextBoard, newNewBoard: nextNewBoard, newRack: nextRack };
};

export default function AnimatedSolutionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const safeParse = (data: unknown) => {
    try {
      return JSON.parse(data as string);
    } catch {
      return [];
    }
  };

  const moves: RummikubMove[] = safeParse(params.moves);
  const rawBoard: RummikubTile[][] = safeParse(params.boardGroups);
  const rawRack: RummikubTile[] = safeParse(params.rackTiles);

  const initialBoard = rawBoard.map(group =>
    group.map(tile => ({ ...tile, _source: 'board' as const }))
  );
  const initialRack = rawRack.map(tile => ({ ...tile, _source: 'rack' as const }));

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visualBoard, setVisualBoard] = useState<RummikubTile[][]>(initialBoard);
  const [visualNewBoard, setVisualNewBoard] = useState<RummikubTile[][]>([]);
  const [visualRack, setVisualRack] = useState<RummikubTile[]>(initialRack);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [history, setHistory] = useState<Array<{
    board: RummikubTile[][];
    newBoard: RummikubTile[][];
    rack: RummikubTile[];
  }>>([]);

  const currentMove = currentStepIndex < moves.length ? moves[currentStepIndex] : null;
  const activeTileKeys = currentMove ? currentMove.tiles.map(getTileKey) : [];

  const getFriendlyInstruction = (description: string) => {
    const withoutGroupIndexes = description
      .replace(/ from group \d+/gi, '')
      .replace(/ to group \d+/gi, '')
      .replace(/group \d+\s*->\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return `The highlighted tiles should be moved like this: ${withoutGroupIndexes}`;
  };

  const getJokerImageSource = (tile: RummikubTile) =>
    tile.color === 'Black' ? JOKER_BLACK : JOKER_RED;

  const AnimatedTile = ({ tile, isActive }: { tile: RummikubTile; isActive: boolean }) => {
    const tileStateStyle = !currentMove ? null : isActive ? styles.activeTile : null;

    return (
      <Animated.View
        layout={LinearTransition.springify().damping(14)}
        entering={FadeIn}
        exiting={FadeOut}
      >
        <View style={[styles.tileBox, tileStateStyle]}>
          {tile.isJoker ? (
            <Image source={getJokerImageSource(tile)} style={styles.jokerImage} resizeMode="contain" />
          ) : (
            <Text
              style={[
                styles.tileText,
                { color: TILE_COLORS[tile.color as keyof typeof TILE_COLORS] || TILE_COLORS.Black },
              ]}
            >
              {tile.number}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  const handleNextStep = () => {
    if (!currentMove || currentStepIndex >= moves.length) {
      return;
    }

    setHistory(prev => [...prev, { board: visualBoard, newBoard: visualNewBoard, rack: visualRack }]);

    const { newBoard, newNewBoard, newRack } = applyMoveToState(
      currentMove,
      visualBoard,
      visualNewBoard,
      visualRack
    );

    setVisualBoard(newBoard);
    setVisualNewBoard(newNewBoard);
    setVisualRack(newRack);
    setCurrentStepIndex(currentStepIndex + 1);
  };

  const handlePrevStep = () => {
    if (history.length === 0) return;

    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setVisualBoard(prev.board);
    setVisualNewBoard(prev.newBoard);
    setVisualRack(prev.rack);
    setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleContinueCapturing = () => {
    setCompletionModalVisible(false);
    router.replace('/home');
  };

  const handleGoToLeaderboard = () => {
    setCompletionModalVisible(false);
    router.push('/leaderboard');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.boardArea}
        contentContainerStyle={styles.boardAreaContent}
        showsVerticalScrollIndicator
      >
        {currentMove ? (
          <View style={styles.topInstructionArea}>
            <Text style={styles.stepCounter}>Step {currentStepIndex + 1} of {moves.length}</Text>
            <Text style={styles.topInstructionText}>
              {getFriendlyInstruction(currentMove.description)}
            </Text>
          </View>
        ) : null}

        <View style={styles.tilesSection}>
          <Text style={styles.sectionTitle}>New Board</Text>
          <View style={styles.boardGrid}>
            {visualNewBoard.length > 0 ? (
              visualNewBoard.map((group, groupIndex) => (
                <Animated.View
                  key={`new-group-${groupIndex}`}
                  layout={LinearTransition}
                  style={styles.groupContainer}
                >
                  {group.map(tile => (
                    <AnimatedTile
                      key={getTileKey(tile)}
                      tile={tile}
                      isActive={activeTileKeys.includes(getTileKey(tile))}
                    />
                  ))}
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyBoardState}>
                <Text style={styles.emptyBoardText}>
                  New groups will appear here as you animate the solution.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.tilesSection}>
          <Text style={styles.rackTitle}>Board</Text>
          <View style={styles.boardGrid}>
              {visualBoard.map((group, groupIndex) => (
                <Animated.View
                  key={`original-group-${groupIndex}`}
                  layout={LinearTransition}
                  style={styles.groupContainer}
                >
                  {group.map(tile => (
                    <AnimatedTile
                      key={getTileKey(tile)}
                      tile={tile}
                      isActive={activeTileKeys.includes(getTileKey(tile))}
                    />
                  ))}
                </Animated.View>
              ))}
          </View>

          {!currentMove && !completionModalVisible ? (
            <TouchableOpacity
              style={styles.completeButton}
              activeOpacity={0.85}
              onPress={() => setCompletionModalVisible(true)}
            >
              <Text style={styles.completeButtonText}>Board Complete!</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.tilesSection}>
        <Text style={styles.rackTitle}>Your Rack</Text>
        <View style={styles.rackContainer}>
          {visualRack.map(tile => (
            <AnimatedTile
              key={getTileKey(tile)}
              tile={tile}
              isActive={activeTileKeys.includes(getTileKey(tile))}
            />
          ))}
        </View>
      </View>

      <View style={styles.navigateButtonsSection}>
        {/* Left Button */}
        <TouchableOpacity
          style={[styles.bottomStepArrow, history.length === 0 && styles.bottomStepArrowDisabled]}
          activeOpacity={0.85}
          onPress={handlePrevStep}
          disabled={history.length === 0}
        >
          <Text style={styles.bottomStepArrowText}>{'<-'}</Text>
        </TouchableOpacity>

        {/* Right Button */}
        <TouchableOpacity
          style={[styles.bottomStepArrow, currentMove === null && styles.bottomStepArrowDisabled]}
          activeOpacity={0.85}
          onPress={handleNextStep}
          disabled={currentMove === null}
        >
          <Text style={styles.bottomStepArrowText}>{'->'}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={completionModalVisible}
        onRequestClose={() => setCompletionModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCompletionModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>All Steps Completed</Text>
            <Text style={styles.modalDescription}>
              Choose whether to capture your next move or view the leaderboard.
            </Text>

            <TouchableOpacity
              style={styles.captureButton}
              activeOpacity={0.85}
              onPress={handleContinueCapturing}
            >
              <Text style={styles.captureButtonText}>Capture Next Move</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.leaderboardButton}
              activeOpacity={0.85}
              onPress={handleGoToLeaderboard}
            >
              <Text style={styles.leaderboardButtonText}>Leaderboard</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  boardArea: {
    flex: 1,
    paddingTop: 64,
  },
  boardAreaContent: {
    paddingBottom: 24,
  },
  topInstructionArea: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    marginBottom: 16,
  },
  tilesSection: { 
    backgroundColor: '#e9ecef',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 16,
    marginTop: 16,
  }, 
boardContent: {
    flexDirection: 'row', // Aligns groups horizontally
    flexWrap: 'wrap',     // Forces groups to wrap to the next line if they don't fit
    alignItems: 'flex-start',
    gap: 12,              // Creates the "grid" spacing between groups
    paddingBottom: 20,    // Adds a little padding at the very bottom of the scroll
  },
  boardGrid: {
    flex: 1,                   // Takes up the remaining vertical space
    flexDirection: 'row',      // Aligns groups horizontally
    flexWrap: 'wrap',          // Forces groups to wrap to the next line
    alignItems: 'flex-start',  // Aligns items at the top of their current row
    alignContent: 'flex-start',// 🚀 CRITICAL: Packs all the wrapped rows tightly to the top
    gap: 12,                   // Spacing between groups
    marginBottom: 16,
  },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 3,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  rackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  boardSummaryContainer: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  rackContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  topInstructionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
    lineHeight: 21,
  },
  completeButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dbe4ee',
  },
  completeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34c759',
    textAlign: 'center',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34c759',
    textAlign: 'center',
    paddingVertical: 8,
  },
  emptyBoardState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBottomState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyBoardText: {
    color: '#6c757d',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  tileBox: {
    width: 42,
    height: 56,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cfd4da',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  tileText: {
    fontSize: 22,
    fontWeight: '900',
  },
  jokerImage: {
    width: 34,
    height: 48,
  },
  activeTile: {
    borderColor: '#007AFF',
    borderWidth: 3,
    shadowColor: '#007AFF',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
    zIndex: 10,
  },
  navigateButtonsSection: {
    flexDirection: 'row', // Places buttons side-by-side
    gap: 12,              // Space between the buttons
    marginTop: 4,         // Adds a tiny bit of breathing room below the rack
    paddingBottom: 16,
  },
  bottomStepArrow: {
    flex: 1,              // 🚀 FORCES BUTTONS TO GROW AND SPLIT THE WIDTH 50/50
    height: 52,
    borderRadius: 26,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomStepArrowDisabled: {
    backgroundColor: '#a0c4f1',
  },
  bottomStepArrowText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2933',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#52606d',
    textAlign: 'center',
    marginBottom: 20,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  leaderboardButton: {
    backgroundColor: '#34c759',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaderboardButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

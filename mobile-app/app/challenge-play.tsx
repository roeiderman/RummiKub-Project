import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EDITOR_THEME, TILE_COLORS } from '../src/constants/colors';
import { RummikubTile } from '../src/types/tile';
import { Scenario, getScenario, submitAttempt } from '../src/services/scenarioService';

const JOKER_RED = require('../assets/images/joker-red.png');
const JOKER_BLACK = require('../assets/images/joker-black.png');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TileSource =
  | { kind: 'rack'; tileIdx: number }
  | { kind: 'board'; groupIdx: number; tileIdx: number };

type SelectedTile = { tile: RummikubTile; source: TileSource };

type HistoryEntry = { rack: RummikubTile[]; boardGroups: RummikubTile[][] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJokerImage(tile: RummikubTile) {
  return tile.color === 'Black' ? JOKER_BLACK : JOKER_RED;
}

// Remove a tile at a given source from current state
function removeTile(
  rack: RummikubTile[],
  boardGroups: RummikubTile[][],
  source: TileSource
): { rack: RummikubTile[]; boardGroups: RummikubTile[][] } {
  if (source.kind === 'rack') {
    const newRack = rack.filter((_, i) => i !== source.tileIdx);
    return { rack: newRack, boardGroups };
  } else {
    const newGroups = boardGroups.map((g, gi) => {
      if (gi !== source.groupIdx) return g;
      return g.filter((_, ti) => ti !== source.tileIdx);
    }).filter(g => g.length > 0);
    return { rack, boardGroups: newGroups };
  }
}

// Insert tile into rack at a given position (or append)
function insertIntoRack(
  rack: RummikubTile[],
  tile: RummikubTile,
  atIdx?: number
): RummikubTile[] {
  const newRack = [...rack];
  if (atIdx !== undefined) {
    newRack.splice(atIdx, 0, tile);
  } else {
    newRack.push(tile);
  }
  return newRack;
}

// Insert tile into a group at a given position (or append)
function insertIntoGroup(
  boardGroups: RummikubTile[][],
  tile: RummikubTile,
  groupIdx: number,
  atTileIdx?: number
): RummikubTile[][] {
  return boardGroups.map((g, gi) => {
    if (gi !== groupIdx) return g;
    const newGroup = [...g];
    if (atTileIdx !== undefined) {
      newGroup.splice(atTileIdx, 0, tile);
    } else {
      newGroup.push(tile);
    }
    return newGroup;
  });
}

// ---------------------------------------------------------------------------
// Tile component
// ---------------------------------------------------------------------------

function TileView({
  tile,
  isSelected,
  onPress,
}: {
  tile: RummikubTile;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.tileBox, isSelected && styles.tileBoxSelected]}
    >
      {tile.isJoker ? (
        <Image source={getJokerImage(tile)} style={styles.jokerImage} resizeMode="contain" />
      ) : (
        <Text style={[styles.tileText, { color: TILE_COLORS[tile.color as keyof typeof TILE_COLORS] || TILE_COLORS.Black }]}>
          {tile.number}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ChallengePlayScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isLoadingScenario, setIsLoadingScenario] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Play state
  const [rack, setRack] = useState<RummikubTile[]>([]);
  const [boardGroups, setBoardGroups] = useState<RummikubTile[][]>([]);
  const [selectedTile, setSelectedTile] = useState<SelectedTile | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultModal, setResultModal] = useState<{
    tilesPlaced: number;
    isNewRecord: boolean;
    previousRecord: number;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Keep a ref for original rack length to compute tiles placed
  const originalRackLength = useRef(0);

  // ---------------------------------------------------------------------------
  // Load scenario
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await getScenario(id);
        setScenario(data);
        // Tag all tiles with _source
        const taggedRack = data.rack.map(t => ({ ...t, _source: 'rack' as const }));
        const taggedBoard = data.board.map(group =>
          group.map(t => ({ ...t, _source: 'board' as const }))
        );
        setRack(taggedRack);
        setBoardGroups(taggedBoard);
        originalRackLength.current = taggedRack.length;
      } catch (e: any) {
        setLoadError(e.message || 'Failed to load scenario');
      } finally {
        setIsLoadingScenario(false);
      }
    })();
  }, [id]);

  // ---------------------------------------------------------------------------
  // Save history before a move
  // ---------------------------------------------------------------------------

  const saveHistory = useCallback(() => {
    setHistory(h => [...h, { rack, boardGroups }]);
  }, [rack, boardGroups]);

  // ---------------------------------------------------------------------------
  // Tile tap handlers
  // ---------------------------------------------------------------------------

  const handleTileTap = useCallback(
    (tile: RummikubTile, source: TileSource) => {
      if (!selectedTile) {
        // Select this tile
        setSelectedTile({ tile, source });
        return;
      }

      // Tapping the same tile → deselect
      const isSame =
        source.kind === selectedTile.source.kind &&
        (source.kind === 'rack'
          ? source.tileIdx === (selectedTile.source as { kind: 'rack'; tileIdx: number }).tileIdx
          : source.groupIdx === (selectedTile.source as { kind: 'board'; groupIdx: number; tileIdx: number }).groupIdx &&
            source.tileIdx === (selectedTile.source as { kind: 'board'; groupIdx: number; tileIdx: number }).tileIdx);

      if (isSame) {
        setSelectedTile(null);
        return;
      }

      // Board → rack: only user-placed tiles (_source:'rack') can go back.
      // Original board tiles stay on the board permanently.
      if (source.kind === 'rack' && selectedTile.source.kind === 'board') {
        if (selectedTile.tile._source !== 'rack') { setSelectedTile(null); return; }
      }

      // Move selected tile to just before this tile
      saveHistory();
      const { rack: r1, boardGroups: b1 } = removeTile(rack, boardGroups, selectedTile.source);

      let newRack = r1;
      let newBoard = b1;

      if (source.kind === 'rack') {
        // Insert into rack at this position (adjusted for removal)
        let insertAt = source.tileIdx;
        if (selectedTile.source.kind === 'rack' && selectedTile.source.tileIdx < source.tileIdx) {
          insertAt--;
        }
        newRack = insertIntoRack(r1, selectedTile.tile, Math.max(0, insertAt));
      } else {
        // Insert into this board group at this position
        let insertAt = source.tileIdx;
        if (
          selectedTile.source.kind === 'board' &&
          selectedTile.source.groupIdx === source.groupIdx &&
          selectedTile.source.tileIdx < source.tileIdx
        ) {
          insertAt--;
        }
        newBoard = insertIntoGroup(b1, selectedTile.tile, source.groupIdx, Math.max(0, insertAt));
      }

      setRack(newRack);
      setBoardGroups(newBoard);
      setSelectedTile(null);
    },
    [selectedTile, rack, boardGroups, saveHistory]
  );

  // Tap on a group's background (not a specific tile) → append selected tile to that group
  const handleGroupBackgroundTap = useCallback(
    (groupIdx: number) => {
      if (!selectedTile) return;
      saveHistory();
      const { rack: r1, boardGroups: b1 } = removeTile(rack, boardGroups, selectedTile.source);
      const newBoard = insertIntoGroup(b1, selectedTile.tile, groupIdx);
      setRack(r1);
      setBoardGroups(newBoard);
      setSelectedTile(null);
    },
    [selectedTile, rack, boardGroups, saveHistory]
  );

  // Tap on rack background → move selected tile to rack
  const handleRackBackgroundTap = useCallback(() => {
    if (!selectedTile) return;
    if (selectedTile.source.kind === 'rack') return; // already in rack
    // Only user-placed tiles can return to rack; original board tiles stay permanently.
    if (selectedTile.source.kind === 'board') {
      if (selectedTile.tile._source !== 'rack') return;
    }
    saveHistory();
    const { rack: r1, boardGroups: b1 } = removeTile(rack, boardGroups, selectedTile.source);
    const newRack = insertIntoRack(r1, selectedTile.tile);
    setRack(newRack);
    setBoardGroups(b1);
    setSelectedTile(null);
  }, [selectedTile, rack, boardGroups, saveHistory]);

  // Tap on "new group" zone → create new group with selected tile
  const handleNewGroupTap = useCallback(() => {
    if (!selectedTile) return;
    saveHistory();
    const { rack: r1, boardGroups: b1 } = removeTile(rack, boardGroups, selectedTile.source);
    setRack(r1);
    setBoardGroups([...b1, [selectedTile.tile]]);
    setSelectedTile(null);
  }, [selectedTile, rack, boardGroups, saveHistory]);

  // Undo
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setRack(prev.rack);
    setBoardGroups(prev.boardGroups);
    setSelectedTile(null);
  }, [history]);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!scenario) return;

    // Client-side check: every group must have ≥ 3 tiles
    const invalidGroups = boardGroups.filter(g => g.length < 3);
    if (invalidGroups.length > 0) {
      setSubmitError(`${invalidGroups.length} group(s) have fewer than 3 tiles. Fix them before submitting.`);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const tilesPlaced = originalRackLength.current - rack.length;
      const result = await submitAttempt(scenario.id, boardGroups, tilesPlaced);
      setResultModal(result);
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed. Check your board.');
    } finally {
      setIsSubmitting(false);
    }
  }, [scenario, boardGroups]);

  const tilesPlacedSoFar = originalRackLength.current - rack.length;

  // ---------------------------------------------------------------------------
  // Loading / error
  // ---------------------------------------------------------------------------

  if (isLoadingScenario) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading challenge…</Text>
      </View>
    );
  }

  if (loadError || !scenario) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError || 'Scenario not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Challenge</Text>
          <Text style={styles.headerSub}>AI removed {scenario.algorithmTilesRemoved} tiles</Text>
        </View>
      </View>

      {/* Record banner */}
      <View style={styles.recordBanner}>
        {scenario.recordHolder ? (
          <Text style={styles.recordText}>
            <Ionicons name="trophy" size={14} color="#F39C12" />
            {'  '}Record: {scenario.recordHolder.tilesPlaced} tiles by{' '}
            {scenario.recordHolder.email.split('@')[0]}
          </Text>
        ) : (
          <Text style={styles.recordText}>
            <Ionicons name="star-outline" size={14} color="#34C759" />
            {'  '}No record yet — be the first!
          </Text>
        )}
        {tilesPlacedSoFar > 0 && (
          <Text style={styles.progressText}>You've placed {tilesPlacedSoFar} tile(s)</Text>
        )}
      </View>

      {/* Board */}
      <ScrollView style={styles.boardScroll} contentContainerStyle={styles.boardContent}>
        <Text style={styles.sectionLabel}>BOARD</Text>

        {boardGroups.map((group, groupIdx) => (
          <TouchableOpacity
            key={groupIdx}
            activeOpacity={selectedTile ? 0.7 : 1}
            onPress={() => handleGroupBackgroundTap(groupIdx)}
            style={[
              styles.groupContainer,
              selectedTile && styles.groupContainerHighlight,
            ]}
          >
            {group.map((tile, tileIdx) => (
              <TileView
                key={`${groupIdx}-${tileIdx}-${tile.tile}`}
                tile={tile}
                isSelected={
                  selectedTile?.source.kind === 'board' &&
                  (selectedTile.source as any).groupIdx === groupIdx &&
                  (selectedTile.source as any).tileIdx === tileIdx
                }
                onPress={() => handleTileTap(tile, { kind: 'board', groupIdx, tileIdx })}
              />
            ))}
          </TouchableOpacity>
        ))}

        {/* New group drop zone */}
        <TouchableOpacity
          style={[styles.newGroupZone, selectedTile && styles.newGroupZoneActive]}
          onPress={handleNewGroupTap}
          activeOpacity={0.75}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={selectedTile ? '#007AFF' : '#bbb'}
          />
          <Text style={[styles.newGroupText, selectedTile && styles.newGroupTextActive]}>
            New Group
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Rack */}
      <TouchableOpacity
        activeOpacity={selectedTile ? 0.8 : 1}
        onPress={handleRackBackgroundTap}
        style={[styles.rackSection, selectedTile && (
          selectedTile.source.kind === 'rack' ||
          (selectedTile.source.kind === 'board' && selectedTile.tile._source === 'rack')
        ) && styles.rackSectionHighlight]}
      >
        <Text style={styles.sectionLabel}>YOUR RACK</Text>
        <View style={styles.rackTiles}>
          {rack.length === 0 ? (
            <Text style={styles.emptyRackText}>All tiles placed!</Text>
          ) : (
            rack.map((tile, tileIdx) => (
              <TileView
                key={`rack-${tileIdx}-${tile.tile}`}
                tile={tile}
                isSelected={
                  selectedTile?.source.kind === 'rack' &&
                  (selectedTile.source as any).tileIdx === tileIdx
                }
                onPress={() => handleTileTap(tile, { kind: 'rack', tileIdx })}
              />
            ))
          )}
        </View>
      </TouchableOpacity>

      {/* Buttons */}
      {submitError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{submitError}</Text>
        </View>
      )}

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.undoButton, history.length === 0 && styles.buttonDisabled]}
          activeOpacity={0.85}
          onPress={handleUndo}
          disabled={history.length === 0}
        >
          <Ionicons name="arrow-undo" size={18} color="#fff" />
          <Text style={styles.buttonText}>Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || tilesPlacedSoFar === 0) && styles.buttonDisabled]}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={isSubmitting || tilesPlacedSoFar === 0}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.buttonText}>Submit</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Result modal */}
      <Modal
        animationType="fade"
        transparent
        visible={resultModal !== null}
        onRequestClose={() => setResultModal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => undefined}>
          <View style={styles.modalCard}>

            {/* Header */}
            <Text style={styles.modalEmoji}>
              {resultModal?.isNewRecord ? '🏆' : '🎉'}
            </Text>
            <Text style={[styles.modalHeaderTitle, resultModal?.isNewRecord && styles.modalHeaderTitleGold]}>
              {resultModal?.isNewRecord ? 'New Record!' : 'Nice Move!'}
            </Text>

            {/* 3 stat boxes: You / AI / Record */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.statBoxGreen]}>
                <Text style={[styles.statNum, { color: '#166534' }]}>
                  {resultModal?.tilesPlaced ?? 0}
                </Text>
                <Text style={styles.statLabel}>You{'\n'}Placed</Text>
              </View>

              <View style={[styles.statBox, styles.statBoxBlue]}>
                <Text style={[styles.statNum, { color: '#1d4ed8' }]}>
                  {scenario?.algorithmTilesRemoved ?? 0}
                </Text>
                <Text style={styles.statLabel}>AI{'\n'}Removed</Text>
              </View>

              <View style={[styles.statBox, styles.statBoxGold]}>
                <Text style={[styles.statNum, { color: '#92400e' }]}>
                  {resultModal?.isNewRecord
                    ? resultModal.tilesPlaced
                    : (resultModal?.previousRecord ?? 0)}
                </Text>
                <Text style={styles.statLabel}>
                  {resultModal?.isNewRecord ? 'New\nRecord' : 'Best\nRecord'}
                </Text>
              </View>
            </View>

            {/* Comparison line */}
            <Text style={styles.comparisonText}>
              {resultModal?.isNewRecord
                ? `You beat the previous record of ${resultModal.previousRecord} tiles!`
                : resultModal !== null && resultModal.previousRecord > 0
                  ? resultModal.tilesPlaced >= resultModal.previousRecord
                    ? 'You matched the record — incredible!'
                    : `${resultModal.previousRecord - resultModal.tilesPlaced} tile(s) away from the record`
                  : 'Be the first to set a record on this challenge!'}
            </Text>

            <View style={styles.modalDivider} />

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => { setResultModal(null); router.replace('/challenges'); }}
            >
              <Text style={styles.primaryButtonText}>Try Another Challenge</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.leaderboardButton}
              activeOpacity={0.85}
              onPress={() => {
                setResultModal(null);
                router.push({
                  pathname: '/challenge-leaderboard',
                  params: { id: scenario!.id, aiScore: String(scenario!.algorithmTilesRemoved) },
                });
              }}
            >
              <Ionicons name="podium-outline" size={16} color="#007AFF" />
              <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => { setResultModal(null); router.replace('/home'); }}
            >
              <Text style={styles.secondaryButtonText}>Home</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 15 },
  errorText: { color: '#D84B4B', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  backBtn: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  // Header
  header: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  // Record banner
  recordBanner: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordText: { fontSize: 13, color: '#555', flex: 1 },
  progressText: { fontSize: 13, color: '#007AFF', fontWeight: '700' },

  // Selection hint
  selectionBanner: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionText: { color: '#fff', fontSize: 13, flex: 1, marginRight: 8 },

  // Board
  boardScroll: { flex: 1 },
  boardContent: { padding: 14, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  groupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    gap: 4,
    minHeight: 52,
  },
  groupContainerHighlight: {
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  newGroupZone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  newGroupZoneActive: {
    borderColor: '#007AFF',
  },
  newGroupText: { color: '#bbb', fontSize: 14, fontWeight: '600' },
  newGroupTextActive: { color: '#007AFF' },

  // Rack
  rackSection: {
    backgroundColor: EDITOR_THEME.pickerBackground,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  rackSectionHighlight: {
    borderTopColor: '#007AFF',
    borderTopWidth: 2,
  },
  rackTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 60,
  },
  emptyRackText: { color: '#fff', fontStyle: 'italic', fontSize: 14, alignSelf: 'center' },

  // Tiles
  tileBox: {
    width: 40,
    height: 52,
    backgroundColor: EDITOR_THEME.tileBackground,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  tileBoxSelected: {
    borderColor: EDITOR_THEME.selectedBorder,
    borderWidth: 2.5,
    shadowColor: EDITOR_THEME.selectedBorder,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
    transform: [{ scale: 1.08 }],
  },
  tileText: { fontSize: 18, fontWeight: '900' },
  jokerImage: { width: 30, height: 44 },

  // Error banner
  errorBanner: {
    backgroundColor: '#FFF0F0',
    borderLeftWidth: 3,
    borderLeftColor: '#D84B4B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 14,
    marginBottom: 4,
    borderRadius: 6,
  },
  errorBannerText: { color: '#D84B4B', fontSize: 13 },

  // Buttons
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  undoButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#6c757d',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitButton: {
    flex: 2,
    height: 48,
    backgroundColor: '#34C759',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  modalEmoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    color: '#1f2933',
    marginBottom: 18,
  },
  modalHeaderTitleGold: {
    color: '#d97706',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  statBoxGreen: { backgroundColor: '#dcfce7' },
  statBoxBlue:  { backgroundColor: '#dbeafe' },
  statBoxGold:  { backgroundColor: '#fef3c7' },
  statNum: {
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  comparisonText: {
    fontSize: 14,
    color: '#52606d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  leaderboardButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#555', fontSize: 16, fontWeight: '600' },
});

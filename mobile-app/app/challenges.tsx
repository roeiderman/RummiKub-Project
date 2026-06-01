import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { Scenario, listScenarios } from '../src/services/scenarioService';

function formatGameDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time };
}

function ScenarioCard({ item, index, onPress, onLeaderboardPress }: {
  item: Scenario;
  index: number;
  onPress: () => void;
  onLeaderboardPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.aiBadge}>
            <Ionicons name="flash" size={13} color="#007AFF" />
            <Text style={styles.aiBadgeText}>AI: {item.algorithmTilesRemoved} tiles</Text>
          </View>
          {item.recordHolder ? (
            <View style={styles.recordBadge}>
              <Ionicons name="trophy" size={13} color="#F39C12" />
              <Text style={styles.recordBadgeText} numberOfLines={1}>
                {item.recordHolder.tilesPlaced} by {item.recordHolder.email.split('@')[0]}
              </Text>
            </View>
          ) : (
            <View style={styles.firstBadge}>
              <Text style={styles.firstBadgeText}>Be the first!</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onLeaderboardPress(); }}
            style={styles.podiumButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="podium-outline" size={18} color="#888" />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </View>
      </View>
      <View style={styles.gameDateTime}>
        <Ionicons name="calendar-outline" size={14} color="#888" />
        <Text style={styles.gameDateText}>{formatGameDate(item.createdAt).date}</Text>
        <Ionicons name="time-outline" size={14} color="#888" style={styles.timeIcon} />
        <Text style={styles.gameDateText}>{formatGameDate(item.createdAt).time}</Text>
      </View>
      {item.createdBy && item.createdBy !== 'unknown' && (
        <View style={styles.playedByRow}>
          <Ionicons name="person-outline" size={13} color="#aaa" />
          <Text style={styles.playedByText}>
            Played by: {item.createdBy.split('@')[0]}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'] as const;
const DIFFICULTY_LABELS: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function buildSections(scenarios: Scenario[]) {
  const buckets: Record<string, Scenario[]> = { easy: [], medium: [], hard: [] };
  for (const s of scenarios) {
    const tier = s.difficulty ?? 'medium';
    buckets[tier].push(s);
  }
  return DIFFICULTY_ORDER
    .filter(tier => buckets[tier].length > 0)
    .map(tier => ({ key: tier, title: DIFFICULTY_LABELS[tier], data: buckets[tier] }));
}

export default function ChallengesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listScenarios();
      setScenarios(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load challenges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await listScenarios();
      setScenarios(data);
    } catch (e: any) {
      setError(e.message || 'Failed to refresh challenges');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Silently refresh data every time the screen comes back into focus
  // (e.g. after submitting a challenge attempt) so recordHolder stays current
  useFocusEffect(
    useCallback(() => {
      if (!isLoading) handleRefresh();
    }, [isLoading, handleRefresh])
  );

  const handlePress = (scenario: Scenario) => {
    if (pathname === '/challenge-play') return;
    router.push({ pathname: '/challenge-play', params: { id: scenario.id } });
  };

  const handleLeaderboardPress = (scenario: Scenario) => {
    router.push({
      pathname: '/challenge-leaderboard',
      params: { id: scenario.id, aiScore: String(scenario.algorithmTilesRemoved) },
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.title}>Training Challenges</Text>
      <Text style={styles.subtitle}>Beat the AI — or someone else's best move</Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <SectionList
          style={styles.list}
          sections={buildSections(scenarios)}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ScenarioCard
              item={item}
              index={index}
              onPress={() => handlePress(item)}
              onLeaderboardPress={() => handleLeaderboardPress(item)}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, styles[`sectionHeader_${section.key}` as keyof typeof styles] as any]}>
              <Text style={[styles.sectionHeaderText, styles[`sectionHeaderText_${section.key}` as keyof typeof styles] as any]}>
                {section.title}
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#4000ffff"
              colors={['#1e00ffff']}
              progressBackgroundColor="#FFFFFF"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="game-controller-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No challenges yet.</Text>
              <Text style={styles.emptySubText}>
                Play a game — when the AI removes more than 4 tiles, it becomes a challenge!
              </Text>
            </View>
          }
          contentContainerStyle={scenarios.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60, paddingHorizontal: 16 },
  backButton: { position: 'absolute', top: 60, left: 16, padding: 4, zIndex: 10 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#333' },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20 },
  list: { flex: 1 },
  loader: { marginTop: 40 },
  errorText: { textAlign: 'center', marginTop: 40, color: '#D84B4B', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  podiumButton: {
    padding: 2,
  },
  badgeRow: { flexDirection: 'row', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8EC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 160,
  },
  recordBadgeText: { color: '#F39C12', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  firstBadge: {
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  firstBadgeText: { color: '#34C759', fontSize: 12, fontWeight: '600' },
  gameDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameDateText: { fontSize: 13, color: '#666' },
  timeIcon: { marginLeft: 8 },
  playedByRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  playedByText: { fontSize: 12, color: '#aaa' },
  sectionHeader: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sectionHeader_easy: { backgroundColor: '#E8F8EE' },
  sectionHeader_medium: { backgroundColor: '#FFF4E0' },
  sectionHeader_hard: { backgroundColor: '#FDE8E8' },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  sectionHeaderText_easy: { color: '#27AE60' },
  sectionHeaderText_medium: { color: '#E67E22' },
  sectionHeaderText_hard: { color: '#E74C3C' },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyText: { fontSize: 18, color: '#666', marginTop: 16, fontWeight: '600' },
  emptySubText: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyList: { flex: 1 },
});

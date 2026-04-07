import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScenarioLeaderboardEntry, getScenarioLeaderboard } from '../src/services/scenarioService';
import { getSessionUser } from '../src/services/sessionService';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ChallengeLeaderboardScreen() {
  const router = useRouter();
  const { id, aiScore } = useLocalSearchParams<{ id: string; aiScore: string }>();

  const [entries, setEntries] = useState<ScenarioLeaderboardEntry[]>([]);
  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, user] = await Promise.all([
        getScenarioLeaderboard(id),
        getSessionUser(),
      ]);
      setEntries(data);
      setMyEmail(user?.email ?? null);
    } catch (e: any) {
      setError(e.message || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const renderRow = ({ item, index }: { item: ScenarioLeaderboardEntry; index: number }) => {
    const isMe = !item.isAI && myEmail && item.email === myEmail;
    const name = item.isAI ? 'AI' : (item.email ?? 'Unknown');
    const rankLabel = index < 3 ? MEDALS[index] : `#${index + 1}`;

    return (
      <View style={[
        styles.row,
        item.isAI && styles.rowAI,
        isMe && styles.rowMe,
      ]}>
        <Text style={styles.rank}>{rankLabel}</Text>

        <View style={styles.rowCenter}>
          {item.isAI && (
            <Ionicons name="flash" size={14} color="#007AFF" style={styles.aiIcon} />
          )}
          <Text style={[styles.name, item.isAI && styles.nameAI, isMe && styles.nameMe]}>
            {name}
            {isMe ? ' (you)' : ''}
          </Text>
        </View>

        <Text style={[styles.score, item.isAI && styles.scoreAI]}>
          {item.bestScore} tiles
        </Text>
      </View>
    );
  };

  const humanCount = entries.filter(e => !e.isAI).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Challenge Leaderboard</Text>
          <Text style={styles.subtitle}>
            AI removed {aiScore} tiles · {humanCount} player{humanCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, index) => item.isAI ? 'ai' : `${item.email ?? index}-${index}`}
          renderItem={renderRow}
          contentContainerStyle={entries.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="podium-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No players yet</Text>
              <Text style={styles.emptySubText}>Be the first to beat this challenge!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  backButton: { padding: 4 },
  headerCenter: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: '#1f2933' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 2 },

  loader: { marginTop: 40 },
  errorText: { textAlign: 'center', marginTop: 40, color: '#D84B4B', fontSize: 15 },

  listContent: { padding: 16, gap: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 8,
  },
  rowAI: {
    backgroundColor: '#EBF4FF',
    borderColor: '#bfdbfe',
  },
  rowMe: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },

  rank: {
    fontSize: 18,
    width: 40,
    textAlign: 'center',
  },
  rowCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  aiIcon: { marginRight: 4 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
  },
  nameAI: { color: '#007AFF' },
  nameMe: { color: '#16a34a' },

  score: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  scoreAI: { color: '#007AFF' },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { fontSize: 18, color: '#666', marginTop: 16, fontWeight: '600' },
  emptySubText: { fontSize: 14, color: '#999', marginTop: 8 },
});

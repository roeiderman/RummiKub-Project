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
import { useRouter } from 'expo-router';
import { LeaderboardEntry, LeaderboardSortBy, getLeaderboard } from '../src/services/leaderboardService';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('maxTilesInOneTurn');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sort: LeaderboardSortBy) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard(sort);
      setEntries(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sortBy);
  }, [sortBy, load]);

  const handleSort = (field: LeaderboardSortBy) => {
    if (field !== sortBy) setSortBy(field);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.title}>Leaderboard</Text>

      {/* Sort buttons */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'maxTilesInOneTurn' && styles.sortButtonActive]}
          onPress={() => handleSort('maxTilesInOneTurn')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'maxTilesInOneTurn' && styles.sortButtonTextActive]}>
            Max Tiles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'totalTurns' && styles.sortButtonActive]}
          onPress={() => handleSort('totalTurns')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'totalTurns' && styles.sortButtonTextActive]}>
            Total Turns
          </Text>
        </TouchableOpacity>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.rankCell]}>#</Text>
        <Text style={[styles.headerCell, styles.emailCell]}>Name</Text>
        <Text style={[styles.headerCell, styles.statCell]}>Turns</Text>
        <Text style={[styles.headerCell, styles.statCell]}>Max Tiles</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(_, index) => String(index)}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index % 2 === 0 && styles.rowEven]}>
              <Text style={[styles.cell, styles.rankCell]}>{index + 1}</Text>
              <Text style={[styles.cell, styles.emailCell]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.cell, styles.statCell]}>{item.totalTurns}</Text>
              <Text style={[styles.cell, styles.statCell, sortBy === 'maxTilesInOneTurn' && styles.highlightedStat]}>
                {item.maxTilesInOneTurn}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No data yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 60, paddingHorizontal: 16 },
  backButton: { position: 'absolute', top: 60, left: 16, padding: 4, zIndex: 10 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#333' },
  sortRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  sortButton: {
    paddingVertical: 8, paddingHorizontal: 20,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#007AFF',
  },
  sortButtonActive: { backgroundColor: '#007AFF' },
  sortButtonText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  sortButtonTextActive: { color: '#fff' },
  tableHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#e0e0e0', borderRadius: 8, marginBottom: 4 },
  headerCell: { fontWeight: '700', fontSize: 13, color: '#555' },
  row: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 6 },
  rowEven: { backgroundColor: '#fff' },
  cell: { fontSize: 13, color: '#333' },
  rankCell: { width: 30 },
  emailCell: { flex: 1, marginRight: 8 },
  statCell: { width: 72, textAlign: 'center' },
  highlightedStat: { color: '#007AFF', fontWeight: '700' },
  loader: { marginTop: 40 },
  errorText: { textAlign: 'center', marginTop: 40, color: '#D84B4B', fontSize: 15 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 15 },
});

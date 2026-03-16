import { type AudioPlayer, useAudioPlayer } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiJson, apiRedirectUrl } from '../../lib/api';
import { hapticDelete, hapticSuccess } from '../../lib/haptics';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import type { Generation, GenerationsResponse } from '../../lib/types';
import { useTheme, type ThemeColors } from '../../providers/ThemeProvider';

const PER_PAGE = 20;
const STATUSES = ['all', 'completed', 'failed', 'pending', 'processing'] as const;
type StatusFilter = (typeof STATUSES)[number];
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Pending',
  processing: 'Active',
};

const STATUS_COLORS_DARK: Record<string, string> = {
  completed: '#0a0',
  failed: '#f44',
  pending: '#fa0',
  processing: '#0af',
  cancelled: '#888',
};

const STATUS_COLORS_LIGHT: Record<string, string> = {
  completed: '#090',
  failed: '#d33',
  pending: '#e90',
  processing: '#07f',
  cancelled: '#999',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function SkeletonCard({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.headerRow}>
        <View style={[styles.skeletonBar, { backgroundColor: colors.skeletonHighlight, height: 18, width: 70 }]} />
        <View style={[styles.skeletonBar, { backgroundColor: colors.skeletonHighlight, height: 16, width: '50%' }]} />
      </View>
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: '90%', marginTop: 10 }]} />
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: '60%', marginTop: 6 }]} />
      <View style={styles.skeletonMetaRow}>
        <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 10, width: 60 }]} />
        <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 10, width: 80 }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// GenerationCard — memoized list item
// ---------------------------------------------------------------------------
type GenerationCardProps = {
  gen: Generation;
  colors: ThemeColors;
  statusColor: string;
  isPlaying: boolean;
  isDeleting: boolean;
  isSharing: boolean;
  player: AudioPlayer | null | undefined;
  onPlay: (gen: Generation) => void;
  onShare: (gen: Generation) => void;
  onDelete: (gen: Generation) => void;
  onRegenerate: (gen: Generation) => void;
};

const GenerationCard = React.memo(function GenerationCard({
  gen, colors, statusColor, isPlaying, isDeleting, isSharing,
  player, onPlay, onShare, onDelete, onRegenerate,
}: GenerationCardProps) {
  const isCompleted = gen.status === 'completed';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {/* Status + voice name */}
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {gen.status}
          </Text>
        </View>
        <Text style={[styles.voiceName, { color: colors.text }]} numberOfLines={1}>
          {gen.voice_name ?? 'Unknown voice'}
        </Text>
        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
          {formatDate(gen.created_at)}
        </Text>
      </View>

      {/* Text preview */}
      <Text style={[styles.textPreview, { color: colors.textSecondary }]} numberOfLines={3}>
        {gen.text}
      </Text>

      {/* Error message */}
      {gen.error_message && (
        <Text selectable style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>
          {gen.error_message}
        </Text>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        {gen.duration_seconds != null && (
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {gen.duration_seconds.toFixed(1)}s
          </Text>
        )}
        {gen.generation_time_seconds != null && (
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            Gen: {gen.generation_time_seconds.toFixed(1)}s
          </Text>
        )}
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
          {gen.language}
        </Text>
      </View>

      {/* Active indicator */}
      {(gen.status === 'pending' || gen.status === 'processing') && (
        <View style={styles.activeRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={[styles.activeText, { color: colors.accent }]}>Generating...</Text>
        </View>
      )}

      {/* Action buttons */}
      {isCompleted && isPlaying && player && (
        <View style={styles.playerContainer}>
          <AudioPlayerBar player={player} />
        </View>
      )}
      <View style={styles.actionsRow}>
        {isCompleted && !isPlaying && (
          <TouchableOpacity
            onPress={() => onPlay(gen)}
            style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>Play</Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <TouchableOpacity
            onPress={() => void onShare(gen)}
            disabled={isSharing}
            style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }, isSharing && styles.disabled]}
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>
              {isSharing ? 'Sharing...' : 'Share'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onRegenerate(gen)}
          style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
        >
          <Text style={[styles.actionText, { color: colors.text }]}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(gen)}
          disabled={isDeleting}
          style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }, isDeleting && styles.disabled]}
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function HistoryScreen() {
  const { colors, isDark } = useTheme();
  const STATUS_COLORS = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  const fetchGenerations = useCallback(async (pageNum: number, append: boolean) => {
    try {
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), per_page: String(PER_PAGE) });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await apiJson<GenerationsResponse>(`/api/generations?${params}`);
      setGenerations(prev => append ? [...prev, ...data.generations] : data.generations);
      setTotalPages(data.pagination.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, statusFilter]);

  // Ref for stable access in pagination effect
  const fetchRef = useRef(fetchGenerations);
  fetchRef.current = fetchGenerations;

  // Fetch on filter/search change (always page 1) — fixes double-fetch (4.3)
  useEffect(() => {
    setPage(1);
    setLoading(true);
    void fetchGenerations(1, false);
  }, [fetchGenerations]);

  // Pagination (page > 1 only)
  useEffect(() => {
    if (page <= 1) return;
    void fetchRef.current(page, true);
  }, [page]);

  // Auto-refresh — uses ref to avoid interval teardown on every fetch (4.6)
  const generationsRef = useRef(generations);
  generationsRef.current = generations;

  useEffect(() => {
    const id = setInterval(() => {
      const hasActive = generationsRef.current.some(
        g => g.status === 'pending' || g.status === 'processing'
      );
      if (hasActive) void fetchGenerations(1, false);
    }, 5000);
    return () => clearInterval(id);
  }, [fetchGenerations]);

  // Play when audio source changes
  useEffect(() => {
    if (audioUri && player) {
      player.play();
    }
  }, [audioUri, player]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    void fetchGenerations(1, false);
  }, [fetchGenerations]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    setPage(p => p + 1);
  }, [loadingMore, page, totalPages]);

  const handlePlay = useCallback(async (gen: Generation) => {
    setPlayingId(gen.id);
    try {
      const url = await apiRedirectUrl(`/api/generations/${gen.id}/audio`);
      setAudioUri(url);
      void hapticSuccess();
    } catch {
      setPlayingId(null);
      Alert.alert('Playback error', 'Could not play audio.');
    }
  }, []);

  const handleShare = useCallback(async (gen: Generation) => {
    setSharingId(gen.id);
    try {
      const url = await apiRedirectUrl(`/api/generations/${gen.id}/audio`);
      const localPath = `${FileSystemLegacy.cacheDirectory}generation_${gen.id}.wav`;
      const download = await FileSystemLegacy.downloadAsync(url, localPath);
      await Sharing.shareAsync(download.uri, { mimeType: 'audio/wav' });
    } catch {
      Alert.alert('Share error', 'Could not share audio.');
    } finally {
      setSharingId(null);
    }
  }, []);

  const handleDelete = useCallback((gen: Generation) => {
    Alert.alert('Delete Generation', 'Delete this generation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          void hapticDelete();
          setDeletingId(gen.id);
          try {
            await apiJson(`/api/generations/${gen.id}`, { method: 'DELETE' });
            setGenerations(prev => prev.filter(g => g.id !== gen.id));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }, []);

  const handleRegenerate = useCallback((gen: Generation) => {
    router.navigate({
      pathname: '/(tabs)/generate',
      params: { voice: gen.voice_id, text: gen.text, language: gen.language },
    });
  }, []);

  const renderGeneration = useCallback(
    ({ item }: { item: Generation }) => (
      <GenerationCard
        gen={item}
        colors={colors}
        statusColor={STATUS_COLORS[item.status] ?? colors.textSecondary}
        isPlaying={playingId === item.id}
        isDeleting={deletingId === item.id}
        isSharing={sharingId === item.id}
        player={playingId === item.id ? player : undefined}
        onPlay={handlePlay}
        onShare={handleShare}
        onDelete={handleDelete}
        onRegenerate={handleRegenerate}
      />
    ),
    [colors, STATUS_COLORS, playingId, deletingId, sharingId, player, handlePlay, handleShare, handleDelete, handleRegenerate],
  );

  if (loading && page === 1) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error && (
        <Text selectable style={[styles.errorBanner, { color: colors.danger }]}>
          {error}
        </Text>
      )}

      <FlatList
        data={generations}
        keyExtractor={(g) => g.id}
        contentInsetAdjustmentBehavior="automatic"
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search history..."
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <View style={[styles.filterRow, { backgroundColor: colors.surface }]}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatusFilter(s)}
                  style={[styles.filterButton, { backgroundColor: statusFilter === s ? colors.border : 'transparent' }]}
                >
                  <Text style={[styles.filterText, { color: statusFilter === s ? colors.text : colors.textSecondary }]}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                {debouncedSearch || statusFilter !== 'all' ? 'No matches' : 'No generations yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {debouncedSearch || statusFilter !== 'all'
                  ? 'Try a different search or filter'
                  : 'Generate some speech to see it here'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: colors.textTertiary }]}>Loading more...</Text>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={renderGeneration}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  card: { borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderCurve: 'continuous' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  voiceName: { fontSize: 15, fontWeight: '600', flex: 1 },
  dateText: { fontSize: 11 },
  textPreview: { fontSize: 13, marginTop: 8 },
  errorText: { fontSize: 12, marginTop: 6 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  metaText: { fontSize: 11 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  activeText: { fontSize: 12 },
  playerContainer: { marginTop: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' },
  actionText: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },

  errorBanner: { fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 8 },

  listHeader: { gap: 10, marginBottom: 12 },
  searchInput: { borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1 },
  filterRow: { flexDirection: 'row', borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' },
  filterButton: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  filterText: { fontSize: 11, fontWeight: '600' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  footerContainer: { paddingVertical: 16, alignItems: 'center' },
  footerText: { fontSize: 13 },

  skeletonBar: { borderRadius: 4 },
  skeletonMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
});

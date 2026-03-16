import { useAudioPlayer } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiJson, apiRedirectUrl } from '../../lib/api';
import { hapticDelete, hapticSuccess } from '../../lib/haptics';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import type { Generation, GenerationsResponse } from '../../lib/types';
import { useTheme } from '../../providers/ThemeProvider';

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

function SkeletonCard({ colors }: { colors: import('../../providers/ThemeProvider').ThemeColors }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: colors.skeletonHighlight, height: 18, width: 70, borderRadius: 4 }} />
        <View style={{ backgroundColor: colors.skeletonHighlight, height: 16, width: '50%', borderRadius: 4 }} />
      </View>
      <View style={{ backgroundColor: colors.surfaceHover, height: 12, width: '90%', borderRadius: 4, marginTop: 10 }} />
      <View style={{ backgroundColor: colors.surfaceHover, height: 12, width: '60%', borderRadius: 4, marginTop: 6 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <View style={{ backgroundColor: colors.surfaceHover, height: 10, width: 60, borderRadius: 4 }} />
        <View style={{ backgroundColor: colors.surfaceHover, height: 10, width: 80, borderRadius: 4 }} />
      </View>
    </View>
  );
}

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
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

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

  useEffect(() => {
    setLoading(page === 1);
    void fetchGenerations(page, page > 1);
  }, [fetchGenerations, page]);

  // Auto-refresh when active items exist
  useEffect(() => {
    if (autoRefreshTimer.current) {
      clearInterval(autoRefreshTimer.current);
      autoRefreshTimer.current = null;
    }
    const hasActive = generations.some(g => g.status === 'pending' || g.status === 'processing');
    if (!hasActive) return;
    autoRefreshTimer.current = setInterval(() => void fetchGenerations(1, false), 5000);
    return () => { if (autoRefreshTimer.current) clearInterval(autoRefreshTimer.current); };
  }, [generations, fetchGenerations]);

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

  if (loading && page === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 8 }}>
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
        <SkeletonCard colors={colors} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {error && (
        <Text selectable style={{ color: colors.danger, fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 8 }}>
          {error}
        </Text>
      )}

      <FlatList
        data={generations}
        keyExtractor={(g) => g.id}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 12 }}>
            <TextInput
              style={{ backgroundColor: colors.surface, color: colors.text, borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
              value={search}
              onChangeText={setSearch}
              placeholder="Search history..."
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' }}>
              {STATUSES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatusFilter(s)}
                  style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: statusFilter === s ? colors.border : 'transparent' }}
                >
                  <Text style={{ color: statusFilter === s ? colors.text : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                    {STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '600' }}>
                {debouncedSearch || statusFilter !== 'all' ? 'No matches' : 'No generations yet'}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                {debouncedSearch || statusFilter !== 'all'
                  ? 'Try a different search or filter'
                  : 'Generate some speech to see it here'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Loading more...</Text>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item: gen }) => {
          const isCompleted = gen.status === 'completed';
          const statusColor = STATUS_COLORS[gen.status] ?? colors.textSecondary;

          return (
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 }}>
              {/* Status + voice name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: `${statusColor}22`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderCurve: 'continuous' }}>
                  <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {gen.status}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {gen.voice_name ?? 'Unknown voice'}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                  {formatDate(gen.created_at)}
                </Text>
              </View>

              {/* Text preview */}
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }} numberOfLines={3}>
                {gen.text}
              </Text>

              {/* Error message */}
              {gen.error_message && (
                <Text selectable style={{ color: colors.danger, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                  {gen.error_message}
                </Text>
              )}

              {/* Meta row */}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                {gen.duration_seconds != null && (
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                    {gen.duration_seconds.toFixed(1)}s
                  </Text>
                )}
                {gen.generation_time_seconds != null && (
                  <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                    Gen: {gen.generation_time_seconds.toFixed(1)}s
                  </Text>
                )}
                <Text style={{ color: colors.textTertiary, fontSize: 11 }}>
                  {gen.language}
                </Text>
              </View>

              {/* Active indicator */}
              {(gen.status === 'pending' || gen.status === 'processing') && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={{ color: colors.accent, fontSize: 12 }}>Generating...</Text>
                </View>
              )}

              {/* Action buttons */}
              {isCompleted && playingId === gen.id && (
                <View style={{ marginTop: 12 }}>
                  <AudioPlayerBar player={player} />
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {isCompleted && playingId !== gen.id && (
                  <TouchableOpacity
                    onPress={() => handlePlay(gen)}
                    style={{ backgroundColor: colors.skeletonHighlight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Play</Text>
                  </TouchableOpacity>
                )}
                {isCompleted && (
                  <TouchableOpacity
                    onPress={() => void handleShare(gen)}
                    disabled={sharingId === gen.id}
                    style={{ backgroundColor: colors.skeletonHighlight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous', opacity: sharingId === gen.id ? 0.4 : 1 }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                      {sharingId === gen.id ? 'Sharing...' : 'Share'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleRegenerate(gen)}
                  style={{ backgroundColor: colors.skeletonHighlight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
                >
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Regenerate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(gen)}
                  disabled={deletingId === gen.id}
                  style={{ backgroundColor: colors.skeletonHighlight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous', opacity: deletingId === gen.id ? 0.4 : 1 }}
                >
                  <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>
                    {deletingId === gen.id ? 'Deleting...' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
      />
    </View>
  );
}

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { type AudioPlayer, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
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
import { useNavigation } from 'expo-router';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import { apiDownloadToFile, apiJson } from '../../lib/api';
import { hapticDelete, hapticSuccess } from '../../lib/haptics';
import type { Voice, VoicesResponse } from '../../lib/types';
import { useTheme, type ThemeColors } from '../../providers/ThemeProvider';

const PER_PAGE = 20;
const SOURCES = ['all', 'uploaded', 'designed'] as const;
type SourceFilter = (typeof SOURCES)[number];
const SOURCE_LABELS: Record<SourceFilter, string> = { all: 'All', uploaded: 'Clone', designed: 'Designed' };

function SkeletonCard({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.skeletonBar, { backgroundColor: colors.skeletonHighlight, height: 16, width: '50%' }]} />
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: '30%', marginTop: 10 }]} />
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceHover, height: 12, width: '80%', marginTop: 8 }]} />
    </View>
  );
}

function SourceBadge({ source, colors }: { source: 'uploaded' | 'designed'; colors: ThemeColors }) {
  return (
    <View style={[styles.sourceBadge, { backgroundColor: colors.skeletonHighlight }]}>
      <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>
        {source === 'designed' ? 'Designed' : 'Clone'}
      </Text>
    </View>
  );
}

const HighlightedText = React.memo(function HighlightedText({ text, highlight, style }: { text: string; highlight: string; style: object }) {
  if (!highlight.trim()) {
    return <Text style={style} numberOfLines={1}>{text}</Text>;
  }
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <Text style={style} numberOfLines={1}>
      {parts.map((part, i) =>
        regex.test(part)
          ? <Text key={i} style={styles.highlight}>{part}</Text>
          : part,
      )}
    </Text>
  );
});

// ---------------------------------------------------------------------------
// VoiceCard — memoized list item
// ---------------------------------------------------------------------------
type VoiceCardProps = {
  voice: Voice;
  colors: ThemeColors;
  highlight: string;
  onGenerate: (voice: Voice) => void;
  onDelete: (voice: Voice) => void;
  onPreview: (voice: Voice) => void;
  isDeleting: boolean;
  isPlaying: boolean;
  player: AudioPlayer | null | undefined;
};

const VoiceCard = React.memo(function VoiceCard({
  voice, colors, highlight, onGenerate, onDelete, onPreview, isDeleting, isPlaying, player,
}: VoiceCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeaderRow}>
        <SourceBadge source={voice.source} colors={colors} />
        <HighlightedText
          text={voice.name}
          highlight={highlight}
          style={[styles.voiceName, { color: colors.text }]}
        />
      </View>
      <Text style={[styles.languageText, { color: colors.textSecondary }]}>
        {voice.language}
      </Text>
      {voice.description ? (
        <Text style={[styles.subtitleText, { color: colors.textTertiary }]} numberOfLines={2}>
          {voice.description}
        </Text>
      ) : voice.reference_transcript ? (
        <Text style={[styles.subtitleText, { color: colors.textTertiary }]} numberOfLines={2}>
          {voice.reference_transcript}
        </Text>
      ) : null}
      {isPlaying && player && (
        <View style={{ marginTop: 10 }}>
          <AudioPlayerBar player={player} />
        </View>
      )}
      <View style={styles.actionsRow}>
        {!isPlaying && (
          <TouchableOpacity
            onPress={() => onPreview(voice)}
            style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
            accessibilityRole="button"
            accessibilityLabel="Preview voice"
          >
            <Text style={[styles.actionText, { color: colors.accent }]}>Preview</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onGenerate(voice)}
          style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }]}
          accessibilityRole="button"
          accessibilityLabel="Generate with this voice"
        >
          <Text style={[styles.actionText, { color: colors.accent }]}>Generate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(voice)}
          disabled={isDeleting}
          style={[styles.actionButton, { backgroundColor: colors.skeletonHighlight }, isDeleting && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Delete voice"
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
export default function VoicesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Shared audio preview — single player for all voice cards
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  // Play when audio source changes
  useEffect(() => {
    if (audioUri && playerStatus.isLoaded) {
      player.play();
    }
  }, [audioUri, player, playerStatus.isLoaded]);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push('/clone')}
            style={[styles.cloneButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Clone a voice"
          >
            <Ionicons name="add" size={16} color="#000" />
            <Text style={styles.cloneButtonText}>Clone</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/account')}
            style={styles.accountButton}
            accessibilityRole="button"
            accessibilityLabel="Account"
          >
            <Ionicons name="person-circle-outline" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, colors]);

  const fetchVoices = useCallback(async (pageNum: number, append: boolean) => {
    try {
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), per_page: String(PER_PAGE) });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (source !== 'all') params.set('source', source);
      const data = await apiJson<VoicesResponse>(`/api/voices?${params}`);
      setVoices(prev => append ? [...prev, ...data.voices] : data.voices);
      setTotalPages(data.pagination.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load voices');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, source]);

  // Ref for stable access in pagination effect
  const fetchRef = useRef(fetchVoices);
  fetchRef.current = fetchVoices;

  // Fetch on filter/search change (always page 1) — fixes double-fetch (4.3)
  useEffect(() => {
    setPage(1);
    setLoading(true);
    void fetchVoices(1, false);
  }, [fetchVoices]);

  // Pagination (page > 1 only)
  useEffect(() => {
    if (page <= 1) return;
    void fetchRef.current(page, true);
  }, [page]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    void fetchVoices(1, false);
  }, [fetchVoices]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    setPage(p => p + 1);
  }, [loadingMore, page, totalPages]);

  const handleDelete = useCallback(
    (voice: Voice) => {
      Alert.alert('Delete Voice', `Delete "${voice.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            void hapticDelete();
            setDeletingId(voice.id);
            try {
              await apiJson(`/api/voices/${voice.id}`, { method: 'DELETE' });
              setVoices((prev) => prev.filter((v) => v.id !== voice.id));
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to delete voice');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [],
  );

  const handlePreview = useCallback(async (voice: Voice) => {
    setPlayingId(voice.id);
    try {
      const localPath = `${FileSystemLegacy.cacheDirectory}voice_preview_${voice.id}.wav`;
      const localUri = await apiDownloadToFile(`/api/voices/${voice.id}/preview`, localPath);
      setAudioUri(localUri);
      void hapticSuccess();
    } catch {
      setPlayingId(null);
      Alert.alert('Preview error', 'Could not play voice preview.');
    }
  }, []);

  const handleGenerate = useCallback((voice: Voice) => {
    router.navigate({ pathname: '/(tabs)/generate', params: { voice: voice.id } });
  }, []);

  const renderVoice = useCallback(
    ({ item }: { item: Voice }) => (
      <VoiceCard
        voice={item}
        colors={colors}
        highlight={debouncedSearch}
        onGenerate={handleGenerate}
        onDelete={handleDelete}
        onPreview={handlePreview}
        isDeleting={deletingId === item.id}
        isPlaying={playingId === item.id}
        player={playingId === item.id ? player : undefined}
      />
    ),
    [colors, debouncedSearch, handleGenerate, handleDelete, handlePreview, deletingId, playingId, player],
  );

  if (loading) {
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
        data={voices}
        keyExtractor={(v) => v.id}
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
              placeholder="Search voices..."
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <View style={[styles.filterRow, { backgroundColor: colors.surface }]}>
              {SOURCES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSource(s)}
                  style={[styles.filterButton, { backgroundColor: source === s ? colors.border : 'transparent' }]}
                >
                  <Text style={[styles.filterText, { color: source === s ? colors.text : colors.textSecondary }]}>
                    {SOURCE_LABELS[s]}
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
                {debouncedSearch || source !== 'all' ? 'No matches' : 'No voices yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                {debouncedSearch || source !== 'all'
                  ? 'Try a different search or filter'
                  : 'Clone a voice or design one to get started'}
              </Text>
              {!debouncedSearch && source === 'all' && (
                <View style={styles.emptyActions}>
                  <TouchableOpacity
                    onPress={() => router.push('/clone')}
                    style={[styles.emptyActionButton, { backgroundColor: colors.text }]}
                  >
                    <Text style={[styles.emptyActionText, { color: colors.background }]}>Clone a Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.navigate('/(tabs)/design')}
                    style={[styles.emptyActionButton, { backgroundColor: colors.skeletonHighlight }]}
                  >
                    <Text style={[styles.emptyActionText, { color: colors.text }]}>Design a Voice</Text>
                  </TouchableOpacity>
                </View>
              )}
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
        renderItem={renderVoice}
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

  headerRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cloneButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderCurve: 'continuous' },
  cloneButtonText: { color: '#000', fontSize: 13, fontWeight: '600' },
  accountButton: { paddingHorizontal: 4, paddingVertical: 4 },

  card: { borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderCurve: 'continuous' },
  sourceBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  voiceName: { fontSize: 16, fontWeight: '600', flex: 1 },
  languageText: { fontSize: 13, marginTop: 6 },
  subtitleText: { fontSize: 13, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' },
  actionText: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },

  highlight: { backgroundColor: '#fa03' },

  errorBanner: { fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 8 },

  listHeader: { gap: 10, marginBottom: 12 },
  searchInput: { borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1 },
  filterRow: { flexDirection: 'row', borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' },
  filterButton: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  filterText: { fontSize: 13, fontWeight: '600' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  emptyActionButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' },
  emptyActionText: { fontSize: 15, fontWeight: '600' },

  footerContainer: { paddingVertical: 16, alignItems: 'center' },
  footerText: { fontSize: 13 },

  skeletonBar: { borderRadius: 4 },
});

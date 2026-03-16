import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { apiJson } from '../../lib/api';
import { hapticDelete } from '../../lib/haptics';
import type { Voice, VoicesResponse } from '../../lib/types';

const PER_PAGE = 20;
const SOURCES = ['all', 'uploaded', 'designed'] as const;
type SourceFilter = (typeof SOURCES)[number];
const SOURCE_LABELS: Record<SourceFilter, string> = { all: 'All', uploaded: 'Clone', designed: 'Designed' };

function SkeletonCard() {
  return (
    <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 }}>
      <View style={{ backgroundColor: '#222', height: 16, width: '50%', borderRadius: 4 }} />
      <View style={{ backgroundColor: '#1a1a1a', height: 12, width: '30%', borderRadius: 4, marginTop: 10 }} />
      <View style={{ backgroundColor: '#1a1a1a', height: 12, width: '80%', borderRadius: 4, marginTop: 8 }} />
    </View>
  );
}

function SourceBadge({ source }: { source: 'uploaded' | 'designed' }) {
  return (
    <View style={{ backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderCurve: 'continuous' }}>
      <Text style={{ color: '#888', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {source === 'designed' ? 'Designed' : 'Clone'}
      </Text>
    </View>
  );
}

function HighlightedText({ text, highlight, style }: { text: string; highlight: string; style: object }) {
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
          ? <Text key={i} style={{ backgroundColor: '#fa03', color: '#fff' }}>{part}</Text>
          : part,
      )}
    </Text>
  );
}

export default function VoicesScreen() {
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

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  // Reset page when search/source changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/clone')}
            style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderCurve: 'continuous' }}
          >
            <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>+ Clone</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/account')} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ color: '#999', fontSize: 20 }}>👤</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

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

  useEffect(() => {
    setLoading(page === 1);
    void fetchVoices(page, page > 1);
  }, [fetchVoices, page]);

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

  const handleGenerate = useCallback((voice: Voice) => {
    router.navigate({ pathname: '/(tabs)/generate', params: { voice: voice.id } });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 8 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {error && (
        <Text selectable style={{ color: '#f44', fontSize: 14, padding: 12, marginHorizontal: 16, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 8 }}>
          {error}
        </Text>
      )}

      <FlatList
        data={voices}
        keyExtractor={(v) => v.id}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 12 }}>
            <TextInput
              style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: '#333' }}
              value={search}
              onChangeText={setSearch}
              placeholder="Search voices..."
              placeholderTextColor="#666"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <View style={{ flexDirection: 'row', backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden' }}>
              {SOURCES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSource(s)}
                  style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: source === s ? '#333' : 'transparent' }}
                >
                  <Text style={{ color: source === s ? '#fff' : '#888', fontSize: 13, fontWeight: '600' }}>
                    {SOURCE_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Text style={{ color: '#888', fontSize: 18, fontWeight: '600' }}>
                {debouncedSearch || source !== 'all' ? 'No matches' : 'No voices yet'}
              </Text>
              <Text style={{ color: '#555', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                {debouncedSearch || source !== 'all'
                  ? 'Try a different search or filter'
                  : 'Clone a voice or design one to get started'}
              </Text>
              {!debouncedSearch && source === 'all' && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                  <TouchableOpacity
                    onPress={() => router.push('/clone')}
                    style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                  >
                    <Text style={{ color: '#000', fontSize: 15, fontWeight: '600' }}>Clone a Voice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.navigate('/(tabs)/design')}
                    style={{ backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Design a Voice</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#555', fontSize: 13 }}>Loading more...</Text>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
            <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SourceBadge source={item.source} />
                <HighlightedText
                  text={item.name}
                  highlight={debouncedSearch}
                  style={{ color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 }}
                />
              </View>
              <Text style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
                {item.language}
              </Text>
              {item.description ? (
                <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : item.reference_transcript ? (
                <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {item.reference_transcript}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => handleGenerate(item)}
                  style={{ backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous' }}
                >
                  <Text style={{ color: '#0af', fontSize: 13, fontWeight: '600' }}>Generate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  style={{ backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderCurve: 'continuous', opacity: deletingId === item.id ? 0.4 : 1 }}
                >
                  <Text style={{ color: '#f44', fontSize: 13, fontWeight: '600' }}>
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        />
    </View>
  );
}

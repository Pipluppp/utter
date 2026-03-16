import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { apiJson } from '../../lib/api';
import type { Voice, VoicesResponse } from '../../lib/types';
import { useAuth } from '../../providers/AuthProvider';

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

export default function VoicesScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          <TouchableOpacity onPress={signOut} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ color: '#666', fontSize: 13 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, signOut]);

  const fetchVoices = useCallback(async () => {
    try {
      setError(null);
      const data = await apiJson<VoicesResponse>('/api/voices');
      setVoices(data.voices);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load voices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchVoices();
  }, [fetchVoices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchVoices();
  }, [fetchVoices]);

  const handleDelete = useCallback(
    (voice: Voice) => {
      Alert.alert('Delete Voice', `Delete "${voice.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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

      {voices.length === 0 && !error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: '#888', fontSize: 18, fontWeight: '600' }}>No voices yet</Text>
          <Text style={{ color: '#555', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            Clone a voice or design one to get started
          </Text>
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
        </View>
      ) : (
        <FlatList
          data={voices}
          keyExtractor={(v) => v.id}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SourceBadge source={item.source} />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {item.name}
                </Text>
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
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

export default function VoicesScreen() {
  const { signOut } = useAuth();
  const navigation = useNavigation();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#fff" size="large" />
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 18, fontWeight: '600' }}>No voices yet</Text>
          <Text style={{ color: '#555', fontSize: 14, marginTop: 8 }}>
            Clone a voice or design one to get started
          </Text>
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
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                {item.language} · {item.source}
              </Text>
              {item.description ? (
                <Text style={{ color: '#666', fontSize: 13, marginTop: 6 }} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

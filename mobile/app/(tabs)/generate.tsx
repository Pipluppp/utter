import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Select } from '../../components/Select';
import { apiJson, apiRedirectUrl } from '../../lib/api';
import type {
  GenerateResponse,
  LanguagesResponse,
  StoredTask,
  Voice,
  VoicesResponse,
} from '../../lib/types';
import { useTasks } from '../../providers/TaskProvider';

export default function GenerateScreen() {
  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks();

  const [voices, setVoices] = useState<Voice[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [voiceId, setVoiceId] = useState('');
  const [language, setLanguage] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingTaskId, setPlayingTaskId] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  const allTasks = getTasksByType('generate');

  useEffect(() => {
    void (async () => {
      try {
        const [voicesData, langsData] = await Promise.all([
          apiJson<VoicesResponse>('/api/voices'),
          apiJson<LanguagesResponse>('/api/languages'),
        ]);
        setVoices(voicesData.voices);
        setLanguages(langsData.languages);
        setLanguage(langsData.default);
        if (voicesData.voices.length > 0) {
          setVoiceId(voicesData.voices[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Play when audio source changes
  useEffect(() => {
    if (audioUri && player) {
      player.play();
    }
  }, [audioUri, player]);

  const handleGenerate = useCallback(async () => {
    if (!voiceId || !text.trim()) {
      Alert.alert('Missing fields', 'Please select a voice and enter text.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiJson<GenerateResponse>('/api/generate', {
        method: 'POST',
        json: { voice_id: voiceId, text: text.trim(), language },
      });
      startTask(res.task_id, 'generate', `Generate: ${text.trim().slice(0, 40)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation');
    } finally {
      setSubmitting(false);
    }
  }, [voiceId, text, language, startTask]);

  const playGeneration = useCallback(async (task: StoredTask) => {
    try {
      const result = task.result as { generation_id?: string } | undefined;
      const genId = result?.generation_id;
      if (!genId) return;

      setPlayingTaskId(task.taskId);
      const url = await apiRedirectUrl(`/api/generations/${genId}/audio`);
      setAudioUri(url);
    } catch {
      setPlayingTaskId(null);
      Alert.alert('Playback error', 'Could not play audio.');
    }
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 4 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {error && (
        <Text selectable style={{ color: '#f44', fontSize: 14, padding: 12, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 12 }}>
          {error}
        </Text>
      )}

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 }}>Voice</Text>
      <Select
        value={voiceId}
        options={voices.map((v) => ({ label: v.name, value: v.id }))}
        onValueChange={setVoiceId}
        placeholder="Select a voice"
      />

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Language</Text>
      <Select
        value={language}
        options={languages.map((l) => ({ label: l, value: l }))}
        onValueChange={setLanguage}
      />

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Text</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: '#333' }}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Enter text to synthesize..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', marginTop: 24, opacity: (submitting || !voiceId || !text.trim()) ? 0.4 : 1 }}
        onPress={handleGenerate}
        disabled={submitting || !voiceId || !text.trim()}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>Generate</Text>
        )}
      </TouchableOpacity>

      {allTasks.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Recent tasks</Text>
          {allTasks.slice(0, 5).map((task) => (
            <View key={task.taskId} style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 14, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 }} numberOfLines={1}>
                  {task.description}
                </Text>
                <Text style={{ color: '#888', fontSize: 13 }}>
                  {task.status === 'completed'
                    ? 'Ready'
                    : task.status === 'failed'
                      ? 'Failed'
                      : task.status === 'cancelled'
                        ? 'Cancelled'
                        : getStatusText(task.status, task.providerStatus)}
                </Text>
              </View>
              {task.status === 'completed' && (
                <TouchableOpacity
                  style={{ marginTop: 10, backgroundColor: '#222', borderRadius: 6, borderCurve: 'continuous', paddingVertical: 8, alignItems: 'center' }}
                  onPress={() => playGeneration(task)}
                  disabled={playingTaskId === task.taskId}
                >
                  <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>
                    {playingTaskId === task.taskId ? 'Playing...' : 'Play'}
                  </Text>
                </TouchableOpacity>
              )}
              {task.status === 'failed' && task.error && (
                <Text selectable style={{ color: '#f44', fontSize: 12, marginTop: 6 }}>{task.error}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

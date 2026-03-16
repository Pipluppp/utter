import { useAudioPlayer } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import { Select } from '../../components/Select';
import { apiJson, apiRedirectUrl } from '../../lib/api';
import { clearFormState, loadFormState, useDebouncedFormSave } from '../../lib/formPersistence';
import { hapticSubmit, hapticSuccess } from '../../lib/haptics';
import type {
  GenerateResponse,
  LanguagesResponse,
  StoredTask,
  Voice,
  VoicesResponse,
} from '../../lib/types';
import { useTasks } from '../../providers/TaskProvider';

const MAX_TEXT_CHARS = 5000;

function formatElapsed(startedAt: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [label, setLabel] = useState(() => formatElapsed(startedAt));

  useEffect(() => {
    const t = setInterval(() => setLabel(formatElapsed(startedAt)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <Text style={{ color: '#888', fontSize: 12 }}>{label}</Text>
  );
}

export default function GenerateScreen() {
  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks();
  const params = useLocalSearchParams<{ voice?: string; text?: string; language?: string }>();

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const appliedVoiceParam = useRef(false);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  const allTasks = getTasksByType('generate');

  type GenerateFormState = { voiceId: string; language: string; text: string };
  const saveForm = useDebouncedFormSave<GenerateFormState>('generate');
  const hasNavParams = Boolean(params.voice || params.text || params.language);

  useEffect(() => {
    void (async () => {
      try {
        const [voicesData, langsData, saved] = await Promise.all([
          apiJson<VoicesResponse>('/api/voices'),
          apiJson<LanguagesResponse>('/api/languages'),
          hasNavParams
            ? Promise.resolve(null)
            : loadFormState<GenerateFormState>('generate'),
        ]);
        setVoices(voicesData.voices);
        setLanguages(langsData.languages);

        if (saved) {
          if (saved.voiceId && voicesData.voices.some((v) => v.id === saved.voiceId)) {
            setVoiceId(saved.voiceId);
          } else if (voicesData.voices.length > 0) {
            setVoiceId(voicesData.voices[0].id);
          }
          if (saved.language && langsData.languages.includes(saved.language)) {
            setLanguage(saved.language);
          } else {
            setLanguage(langsData.default);
          }
          if (saved.text) setText(saved.text);
        } else {
          setLanguage(langsData.default);
          if (voicesData.voices.length > 0 && !params.voice) {
            setVoiceId(voicesData.voices[0].id);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced save of form state
  useEffect(() => {
    if (loading) return;
    saveForm({ voiceId, language, text });
  }, [voiceId, language, text, saveForm, loading]);

  // Apply voice param from navigation (e.g., "Generate from this voice")
  useEffect(() => {
    if (appliedVoiceParam.current) return;
    if (!params.voice || voices.length === 0) return;
    const match = voices.find((v) => v.id === params.voice);
    if (match) {
      setVoiceId(match.id);
      appliedVoiceParam.current = true;
    }
  }, [params.voice, voices]);

  // Apply text + language params from regenerate navigation
  const appliedRegenParams = useRef(false);
  useEffect(() => {
    if (appliedRegenParams.current) return;
    if (params.text) {
      setText(params.text);
      appliedRegenParams.current = true;
    }
    if (params.language && languages.includes(params.language)) {
      setLanguage(params.language);
      appliedRegenParams.current = true;
    }
  }, [params.text, params.language, languages]);

  // Auto-select latest task
  useEffect(() => {
    if (selectedTaskId && allTasks.some((t) => t.taskId === selectedTaskId)) return;
    setSelectedTaskId(allTasks[0]?.taskId ?? null);
  }, [allTasks, selectedTaskId]);

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
    if (text.length > MAX_TEXT_CHARS) {
      Alert.alert('Text too long', `Text must be ${MAX_TEXT_CHARS.toLocaleString()} characters or less.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void hapticSubmit();
      const res = await apiJson<GenerateResponse>('/api/generate', {
        method: 'POST',
        json: { voice_id: voiceId, text: text.trim(), language },
      });
      startTask(res.task_id, 'generate', `Generate: ${text.trim().slice(0, 40)}`);
      setSelectedTaskId(res.task_id);
      void clearFormState('generate');
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
      void hapticSuccess();
    } catch {
      setPlayingTaskId(null);
      Alert.alert('Playback error', 'Could not play audio.');
    }
  }, []);

  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);

  const shareGeneration = useCallback(async (task: StoredTask) => {
    const result = task.result as { generation_id?: string } | undefined;
    const genId = result?.generation_id;
    if (!genId) return;

    setSharingTaskId(task.taskId);
    try {
      const url = await apiRedirectUrl(`/api/generations/${genId}/audio`);
      const localPath = `${FileSystemLegacy.cacheDirectory}generation_${genId}.wav`;
      const download = await FileSystemLegacy.downloadAsync(url, localPath);
      await Sharing.shareAsync(download.uri, { mimeType: 'audio/wav' });
    } catch {
      Alert.alert('Share error', 'Could not share audio.');
    } finally {
      setSharingTaskId(null);
    }
  }, []);

  const charCount = text.length;
  const charOverLimit = charCount > MAX_TEXT_CHARS;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
        {/* Voice selector skeleton */}
        <View style={{ backgroundColor: '#1a1a1a', height: 14, width: 60, borderRadius: 4, marginTop: 12, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', height: 44, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Language selector skeleton */}
        <View style={{ backgroundColor: '#1a1a1a', height: 14, width: 80, borderRadius: 4, marginTop: 20, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', height: 44, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Text input skeleton */}
        <View style={{ backgroundColor: '#1a1a1a', height: 14, width: 40, borderRadius: 4, marginTop: 20, marginBottom: 10 }} />
        <View style={{ backgroundColor: '#111', height: 120, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Button skeleton */}
        <View style={{ backgroundColor: '#222', height: 48, borderRadius: 8, borderCurve: 'continuous', marginTop: 24 }} />
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
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 120, borderWidth: 1, borderColor: charOverLimit ? '#f44' : '#333' }}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Enter text to synthesize..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: charOverLimit ? '#f44' : '#555', fontSize: 12 }}>
          {charCount.toLocaleString()}/{MAX_TEXT_CHARS.toLocaleString()}
        </Text>
        <Text style={{ color: '#555', fontSize: 12 }}>
          Max {MAX_TEXT_CHARS.toLocaleString()} characters
        </Text>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', marginTop: 24, opacity: (submitting || !voiceId || !text.trim() || charOverLimit) ? 0.4 : 1 }}
        onPress={handleGenerate}
        disabled={submitting || !voiceId || !text.trim() || charOverLimit}
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
          {allTasks.length > 2 && (
            <TouchableOpacity
              onPress={() => router.push('/tasks')}
              style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>{allTasks.filter(t => t.status === 'pending' || t.status === 'processing').length} active — View All Tasks →</Text>
            </TouchableOpacity>
          )}
          {allTasks.slice(0, 10).map((task) => {
            const isActive = task.status === 'pending' || task.status === 'processing';
            const isSelected = task.taskId === selectedTaskId;
            return (
              <TouchableOpacity
                key={task.taskId}
                onPress={() => setSelectedTaskId(task.taskId)}
                style={{
                  backgroundColor: isSelected ? '#1a1a1a' : '#111',
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: '#333',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 }} numberOfLines={1}>
                    {task.description}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      {task.status === 'completed'
                        ? 'Ready'
                        : task.status === 'failed'
                          ? 'Failed'
                          : task.status === 'cancelled'
                            ? 'Cancelled'
                            : getStatusText(task.status, task.providerStatus)}
                    </Text>
                    {isActive && (
                      <ElapsedTimer startedAt={task.startedAt} />
                    )}
                  </View>
                </View>
                {task.status === 'completed' && (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {playingTaskId === task.taskId ? (
                      <AudioPlayerBar player={player} />
                    ) : (
                      <TouchableOpacity
                        style={{ backgroundColor: '#222', borderRadius: 6, borderCurve: 'continuous', paddingVertical: 8, alignItems: 'center' }}
                        onPress={() => playGeneration(task)}
                      >
                        <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>Play</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={{ backgroundColor: '#222', borderRadius: 6, borderCurve: 'continuous', paddingVertical: 8, alignItems: 'center' }}
                      onPress={() => shareGeneration(task)}
                      disabled={sharingTaskId === task.taskId}
                    >
                      <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>
                        {sharingTaskId === task.taskId ? 'Sharing...' : 'Share'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {task.status === 'failed' && task.error && (
                  <Text selectable style={{ color: '#f44', fontSize: 12, marginTop: 6 }}>{task.error}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

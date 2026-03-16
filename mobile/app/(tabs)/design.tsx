import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
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
import { hapticSubmit, hapticSuccess } from '../../lib/haptics';
import type { DesignPreviewResponse, DesignSaveResponse, LanguagesResponse, StoredTask } from '../../lib/types';
import { useTasks } from '../../providers/TaskProvider';

const MAX_DESCRIPTION_CHARS = 500;
const MAX_PREVIEW_TEXT_CHARS = 500;

const EXAMPLES = [
  {
    title: 'Warm & steady',
    name: 'Warm & steady',
    instruct:
      'A warm, steady voice with close-mic intimacy. Calm pacing, soft consonants, and a confident but gentle tone.',
  },
  {
    title: 'Bright & fast',
    name: 'Bright & fast',
    instruct:
      'A bright, energetic voice with crisp articulation. Slightly faster pacing, friendly and upbeat without sounding cartoonish.',
  },
  {
    title: 'Low & cinematic',
    name: 'Low & cinematic',
    instruct:
      'A low, cinematic voice with a restrained intensity. Slow pacing, rich timbre, and subtle breathiness.',
  },
];

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

  return <Text style={{ color: '#888', fontSize: 12 }}>{label}</Text>;
}

export default function DesignScreen() {
  const { startTask, getLatestTask, getTasksByType, getStatusText, dismissTask } = useTasks();

  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [text, setText] = useState('');
  const [instruct, setInstruct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  const allTasks = getTasksByType('design_preview');

  const selectedTask = selectedTaskId
    ? allTasks.find((t) => t.taskId === selectedTaskId) ?? null
    : allTasks[0] ?? null;

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<LanguagesResponse>('/api/languages');
        setLanguages(data.languages);
        setLanguage(data.default);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load languages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-select latest task
  useEffect(() => {
    if (selectedTaskId && allTasks.some((t) => t.taskId === selectedTaskId)) return;
    setSelectedTaskId(allTasks[0]?.taskId ?? null);
  }, [allTasks, selectedTaskId]);

  // Wire up audio playback when selected task completes
  useEffect(() => {
    if (!selectedTask || selectedTask.status !== 'completed') {
      setAudioUri(null);
      setSavedVoiceId(null);
      return;
    }
    const result = selectedTask.result as { audio_url?: string } | undefined;
    const audioUrl = result?.audio_url;
    if (!audioUrl) return;

    void (async () => {
      try {
        // audio_url from design preview is a direct URL, use it
        setAudioUri(audioUrl);
      } catch {
        setAudioUri(null);
      }
    })();
  }, [selectedTask?.taskId, selectedTask?.status]);

  // Play when audio source changes
  useEffect(() => {
    if (audioUri && player) {
      player.play();
    }
  }, [audioUri, player]);

  const handlePreview = useCallback(async () => {
    if (!name.trim() || !text.trim() || !instruct.trim()) {
      Alert.alert('Missing fields', 'Please fill in name, text, and voice description.');
      return;
    }
    if (instruct.length > MAX_DESCRIPTION_CHARS) {
      Alert.alert('Too long', `Voice description must be ${MAX_DESCRIPTION_CHARS} characters or less.`);
      return;
    }
    if (text.length > MAX_PREVIEW_TEXT_CHARS) {
      Alert.alert('Too long', `Preview text must be ${MAX_PREVIEW_TEXT_CHARS} characters or less.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      void hapticSubmit();
      const res = await apiJson<DesignPreviewResponse>('/api/voices/design/preview', {
        method: 'POST',
        json: { name: name.trim(), language, text: text.trim(), instruct: instruct.trim() },
      });
      startTask(res.task_id, 'design_preview', `Design: ${name.trim()}`);
      setSelectedTaskId(res.task_id);
      setAudioUri(null);
      setSavedVoiceId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start preview');
    } finally {
      setSubmitting(false);
    }
  }, [name, language, text, instruct, startTask]);

  const handleSave = useCallback(async () => {
    if (!selectedTask || selectedTask.status !== 'completed') return;
    setSaving(true);
    setError(null);
    try {
      const saved = await apiJson<DesignSaveResponse>('/api/voices/design', {
        method: 'POST',
        json: { task_id: selectedTask.taskId, name: name.trim() || 'Designed voice' },
      });
      setSavedVoiceId(saved.id);
      void hapticSuccess();
      Alert.alert('Saved', `"${saved.name}" has been saved to your library.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save voice');
    } finally {
      setSaving(false);
    }
  }, [selectedTask, name]);

  const handlePlayPreview = useCallback(() => {
    if (audioUri && player) {
      player.seekTo(0);
      player.play();
    }
  }, [audioUri, player]);

  const applyExample = useCallback((example: (typeof EXAMPLES)[number]) => {
    setName(example.name);
    setInstruct(example.instruct);
  }, []);

  const instructOverLimit = instruct.length > MAX_DESCRIPTION_CHARS;
  const textOverLimit = text.length > MAX_PREVIEW_TEXT_CHARS;

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
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      {error && (
        <Text selectable style={{ color: '#f44', fontSize: 14, padding: 12, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 12 }}>
          {error}
        </Text>
      )}

      <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Examples</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {EXAMPLES.map((ex) => (
          <TouchableOpacity
            key={ex.title}
            style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 14, width: 200, marginRight: 10 }}
            onPress={() => applyExample(ex)}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{ex.title}</Text>
            <Text style={{ color: '#888', fontSize: 12 }} numberOfLines={2}>{ex.instruct}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 }}>Name</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#333' }}
        value={name}
        onChangeText={setName}
        placeholder="Voice name"
        placeholderTextColor="#666"
      />

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Language</Text>
      <Select
        value={language}
        options={languages.map((l) => ({ label: l, value: l }))}
        onValueChange={setLanguage}
      />

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Voice description</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: instructOverLimit ? '#f44' : '#333' }}
        value={instruct}
        onChangeText={setInstruct}
        multiline
        placeholder="Describe the voice characteristics..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />
      <Text style={{ color: instructOverLimit ? '#f44' : '#555', fontSize: 12, marginTop: 4 }}>
        {instruct.length}/{MAX_DESCRIPTION_CHARS}
      </Text>

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Sample text</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: textOverLimit ? '#f44' : '#333' }}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Text the voice will speak in the preview..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />
      <Text style={{ color: textOverLimit ? '#f44' : '#555', fontSize: 12, marginTop: 4 }}>
        {text.length}/{MAX_PREVIEW_TEXT_CHARS}
      </Text>

      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', marginTop: 24, opacity: submitting || instructOverLimit || textOverLimit ? 0.4 : 1 }}
        onPress={handlePreview}
        disabled={submitting || instructOverLimit || textOverLimit}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>Preview</Text>
        )}
      </TouchableOpacity>

      {/* Audio playback + save section for selected task */}
      {selectedTask && selectedTask.status === 'completed' && audioUri && (
        <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Preview Ready</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              onPress={handlePlayPreview}
              style={{ flex: 1, backgroundColor: '#222', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ flex: 1, backgroundColor: '#0af', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', opacity: saving ? 0.4 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>Save Voice</Text>
              )}
            </TouchableOpacity>
          </View>
          {savedVoiceId && (
            <TouchableOpacity
              onPress={() => router.navigate({ pathname: '/(tabs)/generate', params: { voice: savedVoiceId } })}
              style={{ backgroundColor: '#222', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: '#0af', fontSize: 14, fontWeight: '600' }}>Use Voice →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active task status */}
      {selectedTask && (selectedTask.status === 'pending' || selectedTask.status === 'processing') && (
        <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{selectedTask.description}</Text>
              <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                {getStatusText(selectedTask.status, selectedTask.providerStatus)}
              </Text>
            </View>
            <ElapsedTimer startedAt={selectedTask.startedAt} />
          </View>
        </View>
      )}

      {/* Failed task */}
      {selectedTask && selectedTask.status === 'failed' && (
        <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{selectedTask.description}</Text>
          <Text selectable style={{ color: '#f44', fontSize: 13, marginTop: 4 }}>
            {selectedTask.error ?? 'Failed'}
          </Text>
        </View>
      )}

      {/* Multi-preview task list */}
      {allTasks.length > 1 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Tracked previews</Text>
          {allTasks.map((task) => {
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
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {task.description}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#888', fontSize: 13 }}>
                      {task.status === 'completed'
                        ? 'Ready'
                        : task.status === 'failed'
                          ? 'Failed'
                          : getStatusText(task.status, task.providerStatus)}
                    </Text>
                    {isActive && <ElapsedTimer startedAt={task.startedAt} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

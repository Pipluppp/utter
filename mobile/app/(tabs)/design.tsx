import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Select } from '../../components/Select';
import { AudioPlayerBar } from '../../components/AudioPlayerBar';
import { apiJson } from '../../lib/api';
import { clearFormState, loadFormState, useDebouncedFormSave } from '../../lib/formPersistence';
import { hapticSubmit, hapticSuccess } from '../../lib/haptics';
import type { DesignPreviewResponse, DesignSaveResponse, LanguagesResponse, StoredTask } from '../../lib/types';
import { useTasks } from '../../providers/TaskProvider';
import { useTheme } from '../../providers/ThemeProvider';

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

function ElapsedTimer({ startedAt, colors }: { startedAt: number; colors: import('../../providers/ThemeProvider').ThemeColors }) {
  const [label, setLabel] = useState(() => formatElapsed(startedAt));

  useEffect(() => {
    const t = setInterval(() => setLabel(formatElapsed(startedAt)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>;
}

export default function DesignScreen() {
  const { colors } = useTheme();
  const { startTask, getLatestTask, getTasksByType, getStatusText, dismissTask } = useTasks();

  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [text, setText] = useState('');
  const [instruct, setInstruct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  const allTasks = getTasksByType('design_preview');

  const selectedTask = selectedTaskId
    ? allTasks.find((t) => t.taskId === selectedTaskId) ?? null
    : allTasks[0] ?? null;

  type DesignFormState = { name: string; language: string; text: string; instruct: string };
  const saveForm = useDebouncedFormSave<DesignFormState>('design');

  useEffect(() => {
    void (async () => {
      try {
        const [data, saved] = await Promise.all([
          apiJson<LanguagesResponse>('/api/languages'),
          loadFormState<DesignFormState>('design'),
        ]);
        setLanguages(data.languages);

        if (saved) {
          if (saved.name) setName(saved.name);
          if (saved.language && data.languages.includes(saved.language)) {
            setLanguage(saved.language);
          } else {
            setLanguage(data.default);
          }
          if (saved.text) setText(saved.text);
          if (saved.instruct) setInstruct(saved.instruct);
        } else {
          setLanguage(data.default);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load languages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced save of form state
  useEffect(() => {
    if (loading) return;
    saveForm({ name, language, text, instruct });
  }, [name, language, text, instruct, saveForm, loading]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiJson<LanguagesResponse>('/api/languages');
      setLanguages(data.languages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      void clearFormState('design');
      Alert.alert('Saved', `"${saved.name}" has been saved to your library.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save voice');
    } finally {
      setSaving(false);
    }
  }, [selectedTask, name]);

  const applyExample = useCallback((example: (typeof EXAMPLES)[number]) => {
    setName(example.name);
    setInstruct(example.instruct);
  }, []);

  const instructOverLimit = instruct.length > MAX_DESCRIPTION_CHARS;
  const textOverLimit = text.length > MAX_PREVIEW_TEXT_CHARS;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        {/* Examples skeleton */}
        <View style={{ backgroundColor: colors.surfaceHover, height: 14, width: 80, borderRadius: 4, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ backgroundColor: colors.surface, height: 80, width: 200, borderRadius: 8, borderCurve: 'continuous' }} />
          <View style={{ backgroundColor: colors.surface, height: 80, width: 200, borderRadius: 8, borderCurve: 'continuous' }} />
        </View>
        {/* Name skeleton */}
        <View style={{ backgroundColor: colors.surfaceHover, height: 14, width: 50, borderRadius: 4, marginTop: 28, marginBottom: 10 }} />
        <View style={{ backgroundColor: colors.surface, height: 44, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Language skeleton */}
        <View style={{ backgroundColor: colors.surfaceHover, height: 14, width: 80, borderRadius: 4, marginTop: 20, marginBottom: 10 }} />
        <View style={{ backgroundColor: colors.surface, height: 44, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Description skeleton */}
        <View style={{ backgroundColor: colors.surfaceHover, height: 14, width: 130, borderRadius: 4, marginTop: 20, marginBottom: 10 }} />
        <View style={{ backgroundColor: colors.surface, height: 100, borderRadius: 8, borderCurve: 'continuous' }} />
        {/* Button skeleton */}
        <View style={{ backgroundColor: colors.skeletonHighlight, height: 48, borderRadius: 8, borderCurve: 'continuous', marginTop: 24 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.text} />
      }
    >
      {error && (
        <Text selectable style={{ color: colors.danger, fontSize: 14, padding: 12, backgroundColor: '#1a0000', borderRadius: 8, borderCurve: 'continuous', marginBottom: 12 }}>
          {error}
        </Text>
      )}

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Examples</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {EXAMPLES.map((ex) => (
          <TouchableOpacity
            key={ex.title}
            style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 14, width: 200, marginRight: 10 }}
            onPress={() => applyExample(ex)}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{ex.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={2}>{ex.instruct}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 }}>Name</Text>
      <TextInput
        style={{ backgroundColor: colors.surface, color: colors.text, borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
        value={name}
        onChangeText={setName}
        placeholder="Voice name"
        placeholderTextColor={colors.textTertiary}
      />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Language</Text>
      <Select
        value={language}
        options={languages.map((l) => ({ label: l, value: l }))}
        onValueChange={setLanguage}
      />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Voice description</Text>
      <TextInput
        style={{ backgroundColor: colors.surface, color: colors.text, borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: instructOverLimit ? colors.danger : colors.border }}
        value={instruct}
        onChangeText={setInstruct}
        multiline
        placeholder="Describe the voice characteristics..."
        placeholderTextColor={colors.textTertiary}
        textAlignVertical="top"
      />
      <Text style={{ color: instructOverLimit ? colors.danger : colors.textTertiary, fontSize: 12, marginTop: 4 }}>
        {instruct.length}/{MAX_DESCRIPTION_CHARS}
      </Text>

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Sample text</Text>
      <TextInput
        style={{ backgroundColor: colors.surface, color: colors.text, borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: textOverLimit ? colors.danger : colors.border }}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Text the voice will speak in the preview..."
        placeholderTextColor={colors.textTertiary}
        textAlignVertical="top"
      />
      <Text style={{ color: textOverLimit ? colors.danger : colors.textTertiary, fontSize: 12, marginTop: 4 }}>
        {text.length}/{MAX_PREVIEW_TEXT_CHARS}
      </Text>

      <TouchableOpacity
        style={{ backgroundColor: colors.text, borderRadius: 8, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', marginTop: 24, opacity: submitting || instructOverLimit || textOverLimit ? 0.4 : 1 }}
        onPress={handlePreview}
        disabled={submitting || instructOverLimit || textOverLimit}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>Preview</Text>
        )}
      </TouchableOpacity>

      {/* Audio playback + save section for selected task */}
      {selectedTask && selectedTask.status === 'completed' && audioUri && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Preview Ready</Text>
          <AudioPlayerBar player={player} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', opacity: saving ? 0.4 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={{ color: colors.background, fontSize: 14, fontWeight: '600' }}>Save Voice</Text>
              )}
            </TouchableOpacity>
          </View>
          {savedVoiceId && (
            <TouchableOpacity
              onPress={() => router.navigate({ pathname: '/(tabs)/generate', params: { voice: savedVoiceId } })}
              style={{ backgroundColor: colors.skeletonHighlight, borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Use Voice →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active task status */}
      {selectedTask && (selectedTask.status === 'pending' || selectedTask.status === 'processing') && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{selectedTask.description}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {getStatusText(selectedTask.status, selectedTask.providerStatus)}
              </Text>
            </View>
            <ElapsedTimer startedAt={selectedTask.startedAt} colors={colors} />
          </View>
        </View>
      )}

      {/* Failed task */}
      {selectedTask && selectedTask.status === 'failed' && (
        <View style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{selectedTask.description}</Text>
          <Text selectable style={{ color: colors.danger, fontSize: 13, marginTop: 4 }}>
            {selectedTask.error ?? 'Failed'}
          </Text>
        </View>
      )}

      {/* Multi-preview task list */}
      {allTasks.length > 1 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Tracked previews</Text>
          {allTasks.length > 2 && (
            <TouchableOpacity
              onPress={() => router.push('/tasks')}
              style={{ backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', paddingVertical: 10, alignItems: 'center', marginBottom: 12 }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>{allTasks.filter(t => t.status === 'pending' || t.status === 'processing').length} active — View All Tasks →</Text>
            </TouchableOpacity>
          )}
          {allTasks.map((task) => {
            const isActive = task.status === 'pending' || task.status === 'processing';
            const isSelected = task.taskId === selectedTaskId;
            return (
              <TouchableOpacity
                key={task.taskId}
                onPress={() => setSelectedTaskId(task.taskId)}
                style={{
                  backgroundColor: isSelected ? colors.surfaceHover : colors.surface,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {task.description}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {task.status === 'completed'
                        ? 'Ready'
                        : task.status === 'failed'
                          ? 'Failed'
                          : getStatusText(task.status, task.providerStatus)}
                    </Text>
                    {isActive && <ElapsedTimer startedAt={task.startedAt} colors={colors} />}
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

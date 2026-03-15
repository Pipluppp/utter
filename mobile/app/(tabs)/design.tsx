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
import { apiJson } from '../../lib/api';
import type { DesignPreviewResponse, DesignSaveResponse, LanguagesResponse } from '../../lib/types';
import { useTasks } from '../../providers/TaskProvider';

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

export default function DesignScreen() {
  const { startTask, getLatestTask, getStatusText, dismissTask } = useTasks();

  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [text, setText] = useState('');
  const [instruct, setInstruct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestTask = getLatestTask('design_preview');

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

  const handlePreview = useCallback(async () => {
    if (!name.trim() || !text.trim() || !instruct.trim()) {
      Alert.alert('Missing fields', 'Please fill in name, text, and voice description.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiJson<DesignPreviewResponse>('/api/voices/design/preview', {
        method: 'POST',
        json: { name: name.trim(), language, text: text.trim(), instruct: instruct.trim() },
      });
      startTask(res.task_id, 'design_preview', `Design: ${name.trim()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start preview');
    } finally {
      setSubmitting(false);
    }
  }, [name, language, text, instruct, startTask]);

  const handleSave = useCallback(async () => {
    if (!latestTask || latestTask.status !== 'completed') return;
    setSaving(true);
    setError(null);
    try {
      await apiJson<DesignSaveResponse>('/api/voices/design', {
        method: 'POST',
        json: { task_id: latestTask.taskId, name: name.trim() || 'Designed voice' },
      });
      Alert.alert('Saved', 'Voice has been saved to your library.');
      void dismissTask(latestTask.taskId);
      setName('');
      setText('');
      setInstruct('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save voice');
    } finally {
      setSaving(false);
    }
  }, [latestTask, name, dismissTask]);

  const applyExample = useCallback((example: (typeof EXAMPLES)[number]) => {
    setName(example.name);
    setInstruct(example.instruct);
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

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Sample text</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: '#333' }}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Text the voice will speak in the preview..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />

      <Text style={{ color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Voice description</Text>
      <TextInput
        style={{ backgroundColor: '#111', color: '#fff', borderRadius: 8, borderCurve: 'continuous', padding: 14, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: '#333' }}
        value={instruct}
        onChangeText={setInstruct}
        multiline
        placeholder="Describe the voice characteristics..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={{ backgroundColor: '#fff', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center', marginTop: 24, opacity: submitting ? 0.4 : 1 }}
        onPress={handlePreview}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ color: '#000', fontSize: 16, fontWeight: '600' }}>Preview</Text>
        )}
      </TouchableOpacity>

      {latestTask && (
        <View style={{ backgroundColor: '#111', borderRadius: 8, borderCurve: 'continuous', padding: 16, marginTop: 16 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{latestTask.description}</Text>
          <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            {latestTask.status === 'completed'
              ? 'Preview ready'
              : latestTask.status === 'failed'
                ? latestTask.error ?? 'Failed'
                : getStatusText(latestTask.status, latestTask.providerStatus)}
          </Text>

          {latestTask.status === 'completed' && (
            <TouchableOpacity
              style={{ backgroundColor: '#0af', borderRadius: 8, borderCurve: 'continuous', paddingVertical: 12, alignItems: 'center', marginTop: 12, opacity: saving ? 0.4 : 1 }}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={{ color: '#000', fontSize: 15, fontWeight: '600' }}>Save to Library</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

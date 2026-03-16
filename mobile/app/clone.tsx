import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Select } from '../components/Select';
import { apiJson } from '../lib/api';
import { API_BASE_URL } from '../lib/constants';
import { hapticSubmit, hapticSuccess } from '../lib/haptics';
import type { CloneResponse, LanguagesResponse } from '../lib/types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function contentTypeForUri(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  if (uri.endsWith('.wav')) return 'audio/wav';
  if (uri.endsWith('.mp3')) return 'audio/mpeg';
  if (uri.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}

export default function CloneScreen() {
  const [languages, setLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        setError('Reference audio must be 10MB or smaller.');
        return;
      }

      setFileUri(asset.uri);
      setFileName(asset.name);
      setFileMimeType(asset.mimeType ?? null);
      setError(null);
    } catch {
      setError('Failed to pick file.');
    }
  }, []);

  const loadExample = useCallback(async () => {
    setLoadingExample(true);
    setError(null);
    try {
      const [textRes, audioRes] = await Promise.all([
        fetch(`${API_BASE_URL}/static/examples/audio_text.txt`),
        fetch(`${API_BASE_URL}/static/examples/audio.wav`),
      ]);
      if (!textRes.ok || !audioRes.ok) {
        throw new Error('Failed to load example voice.');
      }
      const exampleText = await textRes.text();
      const audioBlob = await audioRes.blob();

      // Write blob to cache so we can use File(uri)
      const exPath = `${FileSystemLegacy.cacheDirectory}example_audio.wav`;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      await FileSystemLegacy.writeAsStringAsync(exPath, base64, { encoding: FileSystemLegacy.EncodingType.Base64 });

      setName('ASMR');
      setTranscript(exampleText.trim());
      setFileUri(exPath);
      setFileName('audio.wav');
      setFileMimeType('audio/wav');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load example.');
    } finally {
      setLoadingExample(false);
    }
  }, []);

  const handleClone = useCallback(async () => {
    if (!fileUri || !name.trim() || !transcript.trim()) {
      Alert.alert('Missing fields', 'Please select an audio file, enter a name, and provide a transcript.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      void hapticSubmit();
      // Step 1: Get signed upload URL
      const { voice_id, upload_url } = await apiJson<{
        voice_id: string;
        upload_url: string;
        object_key: string;
      }>('/api/clone/upload-url', {
        method: 'POST',
        json: {
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      });

      // Step 2: Upload file to signed URL
      const file = new File(fileUri);
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentTypeForUri(fileUri, fileMimeType),
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio file.');
      }

      // Step 3: Finalize clone
      const res = await apiJson<CloneResponse>('/api/clone/finalize', {
        method: 'POST',
        json: {
          voice_id,
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      });

      void hapticSuccess();
      Alert.alert('Voice Cloned', `"${res.name}" has been added to your library.`, [
        {
          text: 'Go to Generate',
          onPress: () => {
            router.back();
            setTimeout(() => {
              router.navigate({ pathname: '/(tabs)/generate', params: { voice: res.id } });
            }, 300);
          },
        },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone voice.');
    } finally {
      setSubmitting(false);
    }
  }, [fileUri, fileMimeType, name, language, transcript]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Reference Audio</Text>
      <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
        <Text style={styles.fileButtonText}>
          {fileName ?? 'Pick audio file (WAV, MP3, M4A)'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.hint}>10-20 seconds recommended, 60s max, 10MB max</Text>

      <Text style={styles.label}>Voice Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. My Voice"
        placeholderTextColor="#666"
      />

      <Text style={styles.label}>Language</Text>
      <Select
        value={language}
        options={languages.map((l) => ({ label: l, value: l }))}
        onValueChange={setLanguage}
      />

      <Text style={styles.label}>Transcript</Text>
      <TextInput
        style={styles.textArea}
        value={transcript}
        onChangeText={setTranscript}
        multiline
        placeholder="What is said in the reference audio..."
        placeholderTextColor="#666"
        textAlignVertical="top"
      />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        <TouchableOpacity
          style={[styles.exampleButton, loadingExample && styles.buttonDisabled]}
          onPress={loadExample}
          disabled={loadingExample || submitting}
        >
          {loadingExample ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.exampleButtonText}>Try Example</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { flex: 1 },
            (submitting || !fileUri || !name.trim() || !transcript.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleClone}
          disabled={submitting || !fileUri || !name.trim() || !transcript.trim()}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Clone Voice</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    backgroundColor: '#111',
    color: '#fff',
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  fileButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  fileButtonText: { color: '#888', fontSize: 14 },
  hint: { color: '#555', fontSize: 12, marginTop: 6 },
  button: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exampleButton: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  exampleButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  error: {
    color: '#f44',
    fontSize: 14,
    padding: 12,
    backgroundColor: '#1a0000',
    borderRadius: 8,
    marginBottom: 12,
  },
});

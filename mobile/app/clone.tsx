import * as DocumentPicker from 'expo-document-picker';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Select } from '../components/Select';
import { AudioPlayerBar } from '../components/AudioPlayerBar';
import { apiForm, apiJson } from '../lib/api';
import { API_BASE_URL } from '../lib/constants';
import { hapticError, hapticLight, hapticSubmit, hapticSuccess } from '../lib/haptics';
import type { CloneResponse, LanguagesResponse, TranscriptionResponse } from '../lib/types';
import { useTheme } from '../providers/ThemeProvider';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_SECONDS = 60;

type InputMode = 'upload' | 'record';

function contentTypeForUri(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  if (uri.endsWith('.wav')) return 'audio/wav';
  if (uri.endsWith('.mp3')) return 'audio/mpeg';
  if (uri.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}

function formatTimer(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CloneScreen() {
  const { colors } = useTheme();
  const [languages, setLanguages] = useState<string[]>([]);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<InputMode>('upload');

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recording state
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [hasRecording, setHasRecording] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio preview player for uploaded file or recording
  const previewPlayer = useAudioPlayer(
    fileUri && !recorderState.isRecording ? { uri: fileUri } : null,
  );

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<LanguagesResponse>('/api/languages');
        setLanguages(data.languages);
        setLanguage(data.default);
        if (data.transcription?.enabled) setTranscriptionEnabled(true);
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

      // Check duration using a temporary audio player
      try {
        const tempPlayer = createAudioPlayer({ uri: asset.uri });
        const duration = await new Promise<number>((resolve, reject) => {
          let settled = false;
          const timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              reject(new Error('Could not read audio duration'));
            }
          }, 5000);

          const check = () => {
            if (settled) return;
            if (tempPlayer.isLoaded) {
              settled = true;
              clearTimeout(timeoutId);
              resolve(tempPlayer.duration);
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
        tempPlayer.release();
        if (duration > MAX_DURATION_SECONDS) {
          setError(`Reference audio must be ${MAX_DURATION_SECONDS} seconds or shorter (got ${Math.round(duration)}s).`);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not read audio duration');
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

  // ---- Recording ----
  const requestMicPermission = useCallback(async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert('Microphone Access', 'Microphone permission is required to record audio. Please enable it in Settings.');
    }
    return granted;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (permissionGranted === null || permissionGranted === false) {
      const granted = await requestMicPermission();
      if (!granted) return;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_DURATION_SECONDS });
      void hapticLight();
      setHasRecording(false);

      // Auto-stop safety (forDuration should handle it, but just in case)
      autoStopTimer.current = setTimeout(async () => {
        if (recorder.isRecording) {
          await recorder.stop();
        }
      }, (MAX_DURATION_SECONDS + 1) * 1000);
    } catch (e) {
      void hapticError();
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    }
  }, [permissionGranted, requestMicPermission, recorder]);

  const stopRecording = useCallback(async () => {
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    try {
      await recorder.stop();
      void hapticSuccess();
      const uri = recorder.uri;
      if (uri) {
        setFileUri(uri);
        setFileName('recording.m4a');
        setFileMimeType('audio/mp4');
        setHasRecording(true);

        // Auto-transcribe if available
        if (transcriptionEnabled && !transcript.trim()) {
          setTranscribing(true);
          try {
            const form = new FormData();
            // RN FormData accepts { uri, type, name } for file uploads; cast is a TS workaround
            form.append('audio', { uri, type: 'audio/mp4', name: 'recording.m4a' } as any);
            form.append('language', language);
            const res = await apiForm<TranscriptionResponse>('/api/transcriptions', form, { method: 'POST' });
            if (res.text) setTranscript(res.text);
          } catch {
            // Non-fatal: user can type transcript manually
          } finally {
            setTranscribing(false);
          }
        }
      }
    } catch (e) {
      void hapticError();
      setError(e instanceof Error ? e.message : 'Failed to stop recording');
    }
  }, [recorder, transcriptionEnabled, transcript, language]);

  const clearRecording = useCallback(() => {
    setFileUri(null);
    setFileName(null);
    setFileMimeType(null);
    setHasRecording(false);
    void hapticLight();
  }, []);

  // Clean up auto-stop timer and stop recording on unmount (modal dismiss)
  useEffect(() => {
    return () => {
      if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
  }, [recorder]);

  const loadExample = useCallback(async () => {
    setLoadingExample(true);
    setError(null);
    try {
      // Public static assets served without auth — no apiJson needed
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  }

  const meterLevel = recorderState.metering != null
    ? Math.max(0, Math.min(1, (recorderState.metering + 60) / 60))
    : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      {/* Mode toggle */}
      <Text style={[styles.label, { color: colors.textSecondary }]}>Input Mode</Text>
      <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, borderCurve: 'continuous', overflow: 'hidden', marginBottom: 16 }}>
        {(['upload', 'record'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === m ? colors.border : 'transparent' }}
          >
            <Text style={{ color: mode === m ? colors.text : colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              {m === 'upload' ? 'Upload' : 'Record'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Upload mode */}
      {mode === 'upload' && (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Reference Audio</Text>
          <TouchableOpacity style={[styles.fileButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={pickFile}>
            <Text style={[styles.fileButtonText, { color: colors.textSecondary }]}>
              {fileName ?? 'Pick audio file (WAV, MP3, M4A)'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>10-20 seconds recommended, 60s max, 10MB max</Text>
          {fileUri && !recorderState.isRecording && (
            <View style={{ marginTop: 10 }}>
              <AudioPlayerBar player={previewPlayer} />
            </View>
          )}
        </>
      )}

      {/* Record mode */}
      {mode === 'record' && (
        <>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Record Audio</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderCurve: 'continuous', padding: 16, gap: 12 }}>
            {/* Level meter */}
            <View style={{ height: 8, backgroundColor: colors.skeletonHighlight, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{
                height: '100%',
                width: `${meterLevel * 100}%`,
                backgroundColor: recorderState.isRecording ? '#0f0' : '#444',
                borderRadius: 4,
              }} />
            </View>

            {/* Timer */}
            <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] }}>
              {formatTimer(recorderState.durationMillis)}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center' }}>
              {MAX_DURATION_SECONDS}s max
            </Text>

            {/* Controls */}
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
              {!recorderState.isRecording && !hasRecording && (
                <TouchableOpacity
                  onPress={() => void startRecording()}
                  style={{ backgroundColor: '#d00', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Start</Text>
                </TouchableOpacity>
              )}
              {recorderState.isRecording && (
                <TouchableOpacity
                  onPress={() => void stopRecording()}
                  style={{ backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                >
                  <Text style={{ color: '#000', fontSize: 15, fontWeight: '600' }}>Stop</Text>
                </TouchableOpacity>
              )}
              {hasRecording && !recorderState.isRecording && (
                <>
                  <TouchableOpacity
                    onPress={clearRecording}
                    style={{ backgroundColor: colors.skeletonHighlight, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                  >
                    <Text style={{ color: '#f66', fontSize: 15, fontWeight: '600' }}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void startRecording()}
                    style={{ backgroundColor: '#d00', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderCurve: 'continuous' }}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Re-record</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Recording status */}
            {recorderState.isRecording && (
              <Text style={{ color: '#d00', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>● Recording...</Text>
            )}
            {hasRecording && !recorderState.isRecording && (
              <Text style={{ color: '#4c6', fontSize: 13, textAlign: 'center' }}>Recording ready: {fileName}</Text>
            )}
            {transcribing && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <ActivityIndicator color={colors.textSecondary} size="small" />
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Transcribing...</Text>
              </View>
            )}

            {permissionGranted === false && (
              <Text style={{ color: '#f90', fontSize: 13, textAlign: 'center' }}>
                Microphone permission denied. Please enable in Settings.
              </Text>
            )}
          </View>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>10-20 seconds recommended, {MAX_DURATION_SECONDS}s max</Text>
          {hasRecording && !recorderState.isRecording && fileUri && (
            <View style={{ marginTop: 10 }}>
              <AudioPlayerBar player={previewPlayer} />
            </View>
          )}
        </>
      )}

      <Text style={[styles.label, { color: colors.textSecondary }]}>Voice Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. My Voice"
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>Language</Text>
      <Select
        value={language}
        options={languages.map((l) => ({ label: l, value: l }))}
        onValueChange={setLanguage}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>Transcript</Text>
      <TextInput
        style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        value={transcript}
        onChangeText={setTranscript}
        multiline
        blurOnSubmit={false}
        placeholder="What is said in the reference audio..."
        placeholderTextColor={colors.textTertiary}
        textAlignVertical="top"
      />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        <TouchableOpacity
          style={[styles.exampleButton, { backgroundColor: colors.skeletonHighlight }, loadingExample && styles.buttonDisabled]}
          onPress={loadExample}
          disabled={loadingExample || submitting}
        >
          {loadingExample ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={[styles.exampleButtonText, { color: colors.text }]}>Try Example</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { flex: 1, backgroundColor: colors.text },
            (submitting || !fileUri || !name.trim() || !transcript.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleClone}
          disabled={submitting || !fileUri || !name.trim() || !transcript.trim()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.background }]}>Clone Voice</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
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

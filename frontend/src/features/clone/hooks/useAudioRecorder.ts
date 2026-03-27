import { useCallback, useEffect, useRef, useState } from "react";
import { buildWavFile } from "../../../lib/audio/audio";

interface UseAudioRecorderOptions {
  maxSeconds: number;
}

interface AudioRecorderResult {
  recording: boolean;
  micLevel: number;
  recordSeconds: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<File | null>;
  clear: () => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions): AudioRecorderResult {
  const { maxSeconds } = options;

  const [recording, setRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSamplesRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  /** Tear down all audio resources without producing a file. */
  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setMicLevel(0);

    const worklet = workletRef.current;
    workletRef.current = null;
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.disconnect();
    }
    const audioCtx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (audioCtx) {
      void audioCtx.close();
    }

    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
  }, []);

  const start = useCallback(async () => {
    // Guard against double-start
    if (activeRef.current) return;

    setError(null);
    setRecordSeconds(0);
    pcmChunksRef.current = [];
    pcmSamplesRef.current = 0;

    // Step 1: getUserMedia
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to access microphone.");
      return;
    }
    streamRef.current = stream;

    // Step 2: AudioContext at 24 kHz
    let audioCtx: AudioContext;
    try {
      audioCtx = new AudioContext({ sampleRate: 24000 });
    } catch (e) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
      if (e instanceof DOMException && e.name === "NotSupportedError") {
        setError("Browser does not support 24 kHz recording.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to create AudioContext.");
      }
      return;
    }
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);

    // Step 3: AudioWorklet support check
    if (!audioCtx.audioWorklet) {
      cleanup();
      setError("Browser does not support AudioWorklet recording.");
      return;
    }

    // Step 4: Load worklet module
    const workletUrl = new URL("../../../lib/audio/pcmCapture.worklet.js", import.meta.url);
    try {
      await audioCtx.audioWorklet.addModule(workletUrl);
    } catch (e) {
      cleanup();
      setError(e instanceof Error ? e.message : "Failed to load audio worklet.");
      return;
    }

    // Step 5: Create worklet node and wire up PCM accumulation
    const worklet = new AudioWorkletNode(audioCtx, "utter-pcm-capture", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    workletRef.current = worklet;

    worklet.port.onmessage = (ev) => {
      const data = ev.data as unknown;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: unknown }).type !== "chunk") return;
      const buffer = (data as { buffer?: unknown }).buffer;
      if (!(buffer instanceof ArrayBuffer)) return;
      const chunk = new Float32Array(buffer);
      pcmChunksRef.current.push(chunk);
      pcmSamplesRef.current += chunk.length;

      // Compute RMS directly from raw PCM for a punchy, real-time meter
      let sumSq = 0;
      for (let i = 0; i < chunk.length; i++) {
        const v = chunk[i]!;
        sumSq += v * v;
      }
      setMicLevel(Math.sqrt(sumSq / chunk.length));
    };

    // Step 6: Connect source → worklet → zeroGain → destination
    const zeroGain = audioCtx.createGain();
    zeroGain.gain.value = 0;
    source.connect(worklet);
    worklet.connect(zeroGain);
    zeroGain.connect(audioCtx.destination);

    activeRef.current = true;
    setRecording(true);

    // Step 8: Interval timer for recordSeconds, auto-stop at maxSeconds
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((prev) => {
        const next = prev + 1;
        if (next >= maxSeconds && activeRef.current) {
          // Schedule stop outside the setState updater
          window.setTimeout(() => {
            void stopRef.current();
          }, 0);
        }
        return next;
      });
    }, 1000);
  }, [maxSeconds, cleanup]);

  const stop = useCallback(async (): Promise<File | null> => {
    if (!activeRef.current) return null;

    activeRef.current = false;
    setRecording(false);
    cleanup();

    const sampleCount = pcmSamplesRef.current;
    if (sampleCount <= 0) {
      setError("No audio captured.");
      return null;
    }

    return buildWavFile(pcmChunksRef.current, sampleCount, 24000);
  }, [cleanup]);

  // Stable ref so the interval timer can always call the latest stop
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const clear = useCallback(() => {
    activeRef.current = false;
    setRecording(false);
    cleanup();
    pcmChunksRef.current = [];
    pcmSamplesRef.current = 0;
    setRecordSeconds(0);
    setError(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    recording,
    micLevel,
    recordSeconds,
    error,
    start,
    stop,
    clear,
  };
}

import { useCallback, useState } from "react";
import { getAudioDurationSeconds } from "../../../lib/audio/audio";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_SECONDS = 60;
const ALLOWED_EXTS = new Set([".wav", ".mp3", ".m4a"]);

export function extOf(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export type CloneFileResult = {
  file: File | null;
  fileError: string | null;
  fileInfo: string | null;
  validateAndSet: (next: File | null) => Promise<boolean>;
  clear: () => void;
  setFile: (file: File | null) => void;
};

export function useCloneFile(): CloneFileResult {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInfo = file ? `${file.name} - ${(file.size / (1024 * 1024)).toFixed(1)} MB` : null;

  const validateAndSet = useCallback(async (next: File | null) => {
    setFileError(null);
    setFile(null);
    if (!next) return false;

    const ext = extOf(next.name);
    if (!ALLOWED_EXTS.has(ext)) {
      setFileError("File must be WAV, MP3, or M4A.");
      return false;
    }
    if (next.size > MAX_FILE_BYTES) {
      setFileError("Reference audio must be 10MB or smaller.");
      return false;
    }

    const duration = await getAudioDurationSeconds(next).catch(() => null);
    if (duration !== null && duration > MAX_REFERENCE_SECONDS + 0.25) {
      setFileError("Reference audio must be 60 seconds or shorter.");
      return false;
    }

    setFile(next);
    return true;
  }, []);

  const clear = useCallback(() => {
    setFile(null);
    setFileError(null);
  }, []);

  return { file, fileError, fileInfo, validateAndSet, clear, setFile };
}

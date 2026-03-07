import {
  createQwenCloneVoice,
  createQwenDesignedVoice,
  decodeBase64Audio,
} from "./qwen_customization.ts";
import { synthesizeQwenNonStreaming } from "./qwen_synthesis.ts";
import { downloadQwenAudioWithRetry } from "./qwen_audio.ts";

export const qwenProvider = {
  createQwenCloneVoice,
  createQwenDesignedVoice,
  decodeBase64Audio,
  synthesizeQwenNonStreaming,
  downloadQwenAudioWithRetry,
};

import type { TtsJobMessage } from "./messages.ts";

export async function enqueueTtsJob(
  queue: Queue | undefined,
  message: TtsJobMessage,
) {
  if (!queue) throw new Error("TTS_QUEUE binding is not configured.");
  await queue.send(message);
}

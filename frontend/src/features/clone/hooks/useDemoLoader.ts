import { useEffect, useRef } from "react";
import { getUtterDemo } from "../../../content/utterDemo";
import { fetchTextUtf8 } from "../../../lib/fetchTextUtf8";
import { extOf } from "./useCloneFile";

export type DemoFormFill = {
  name: string;
  transcript: string;
  file: File;
};

/**
 * Loads a demo by id (from route search param) and calls `onLoad` once with
 * the pre-filled form values. The caller owns all state — this hook only
 * fetches and transforms.
 */
export function useDemoLoader(
  demoId: string | undefined,
  onLoad: (fill: DemoFormFill) => void,
  onError: (msg: string) => void,
) {
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!demoId) return;
    if (loadedRef.current === demoId) return;
    loadedRef.current = demoId;

    const demo = getUtterDemo(demoId);
    const audioUrl = demo?.audioUrl;
    if (!demo || !audioUrl) return;

    void (async () => {
      try {
        const [audioRes, transcriptText] = await Promise.all([
          fetch(audioUrl),
          demo.transcriptUrl ? fetchTextUtf8(demo.transcriptUrl) : Promise.resolve(""),
        ]);
        if (!audioRes.ok) throw new Error("Failed to load demo audio.");
        const audioBlob = await audioRes.blob();
        const ext = extOf(new URL(audioUrl, window.location.href).pathname);
        const fileName = `${demo.id}${ext || ".mp3"}`;
        const file = new File([audioBlob], fileName, {
          type: audioBlob.type || "audio/mpeg",
        });

        onLoad({
          name: demo.suggestedCloneName ?? `${demo.title} (demo)`,
          transcript: transcriptText.trim(),
          file,
        });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to load demo.");
      }
    })();
  }, [demoId]); // eslint-disable-line react-hooks/exhaustive-deps -- onLoad/onError are stable callbacks from the caller
}

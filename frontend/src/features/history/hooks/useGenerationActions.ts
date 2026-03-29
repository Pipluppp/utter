import { useCallback } from "react";
import { apiJson } from "../../../lib/api";
import { resolveProtectedMediaUrl, triggerDownload } from "../../../lib/protectedMedia";
import type { Generation, RegenerateResponse } from "../../../lib/types";

export type UseGenerationActionsResult = {
  deleteGeneration: (gen: Generation) => Promise<void>;
  regenerate: (gen: Generation) => Promise<void>;
  download: (audioUrl: string) => Promise<void>;
};

export function useGenerationActions(
  onReload: () => void,
  onError: (msg: string) => void,
  navigate: (opts: { to: string }) => void,
): UseGenerationActionsResult {
  const deleteGeneration = useCallback(
    async (gen: Generation) => {
      try {
        await apiJson(`/api/generations/${gen.id}`, { method: "DELETE" });
        onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to delete generation.");
      }
    },
    [onReload, onError],
  );

  const regenerate = useCallback(
    async (gen: Generation) => {
      try {
        const res = await apiJson<RegenerateResponse>(`/api/generations/${gen.id}/regenerate`, {
          method: "POST",
        });
        navigate({ to: res.redirect_url });
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to regenerate.");
      }
    },
    [onError, navigate],
  );

  const download = useCallback(
    async (audioUrl: string) => {
      try {
        const resolvedUrl = await resolveProtectedMediaUrl(audioUrl);
        triggerDownload(resolvedUrl);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to download audio.");
      }
    },
    [onError],
  );

  return { deleteGeneration, regenerate, download };
}

import { useCallback, useState } from "react";
import { apiJson } from "../../../lib/api";
import type { Voice } from "../../../lib/types";

export type UseVoiceMutationsResult = {
  busyDelete: string | null;
  busyFavorite: string | null;
  busyRename: string | null;
  deleteVoice: (voice: Voice) => Promise<void>;
  toggleFavorite: (voice: Voice) => Promise<void>;
  renameVoice: (voice: Voice, name: string) => Promise<void>;
};

export function useVoiceMutations(
  onReload: () => void,
  onError: (msg: string) => void,
): UseVoiceMutationsResult {
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
  const [busyRename, setBusyRename] = useState<string | null>(null);

  const deleteVoice = useCallback(
    async (voice: Voice) => {
      setBusyDelete(voice.id);
      try {
        await apiJson(`/api/voices/${voice.id}`, { method: "DELETE" });
        onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to delete voice.");
      } finally {
        setBusyDelete(null);
      }
    },
    [onReload, onError],
  );

  const toggleFavorite = useCallback(
    async (voice: Voice) => {
      setBusyFavorite(voice.id);
      try {
        await apiJson(`/api/voices/${voice.id}/favorite`, { method: "PATCH" });
        onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to update favorite.");
      } finally {
        setBusyFavorite(null);
      }
    },
    [onReload, onError],
  );

  const renameVoice = useCallback(
    async (voice: Voice, name: string) => {
      setBusyRename(voice.id);
      try {
        await apiJson(`/api/voices/${voice.id}/name`, {
          method: "PATCH",
          json: { name },
        });
        onReload();
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to rename voice.");
      } finally {
        setBusyRename(null);
      }
    },
    [onReload, onError],
  );

  return { busyDelete, busyFavorite, busyRename, deleteVoice, toggleFavorite, renameVoice };
}

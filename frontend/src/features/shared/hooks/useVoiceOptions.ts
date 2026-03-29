import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../../lib/api";
import type { Voice, VoicesResponse } from "../../../lib/types";

export type VoiceOptionItem = Voice & { label: string };

export type UseVoiceOptionsResult = {
  voices: VoiceOptionItem[];
  loading: boolean;
  error: string | null;
};

export function useVoiceOptions(): UseVoiceOptionsResult {
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiJson<VoicesResponse>("/api/voices");
        if (!active) return;
        setData(res);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load voices.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const voices = useMemo(() => (data?.voices ?? []).map((v) => ({ ...v, label: v.name })), [data]);

  return { voices, loading, error };
}

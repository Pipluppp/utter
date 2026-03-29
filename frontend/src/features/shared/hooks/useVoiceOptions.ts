import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Voice } from "../../../lib/types";
import { voiceQueries } from "../../voices/queries";

export type VoiceOptionItem = Voice & { label: string };

export type UseVoiceOptionsResult = {
  voices: VoiceOptionItem[];
  loading: boolean;
  error: string | null;
};

export function useVoiceOptions(): UseVoiceOptionsResult {
  const query = useQuery(voiceQueries.options());

  const voices = useMemo(
    () => (query.data?.voices ?? []).map((v) => ({ ...v, label: v.name })),
    [query.data],
  );

  return {
    voices,
    loading: query.isPending,
    error: query.error?.message ?? null,
  };
}

import { VoiceCardSkeleton } from "./VoiceCardSkeleton";

const VOICE_SKELETON_VARIANTS = [
  { id: "designed-a", showPrompt: true },
  { id: "clone-a", showPrompt: false },
  { id: "designed-b", showPrompt: true },
  { id: "clone-b", showPrompt: false },
] as const;

export function VoicesSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      {VOICE_SKELETON_VARIANTS.map(({ id, showPrompt }) => (
        <VoiceCardSkeleton key={id} showPrompt={showPrompt} />
      ))}
    </div>
  );
}

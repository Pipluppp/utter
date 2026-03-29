import { Button } from "../../../components/atoms/Button";
import { WaveformPlayer } from "../../../components/organisms/WaveformPlayer";

export interface DesignResultProps {
  previewUrl: string;
  previewBlob: Blob | undefined;
  savedVoiceName: string | null;
  isSavingVoice: boolean;
  canSave: boolean;
  onSave: () => void;
}

export function DesignResult({
  previewUrl,
  previewBlob,
  savedVoiceName,
  isSavingVoice,
  canSave,
  onSave,
}: DesignResultProps) {
  return (
    <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium uppercase tracking-wide">Preview</div>
          {savedVoiceName ? <div className="mt-1 text-xs text-faint">{savedVoiceName}</div> : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          onPress={onSave}
          isDisabled={!canSave || isSavingVoice}
        >
          {isSavingVoice ? "Saving voice..." : "Save This Preview"}
        </Button>
      </div>
      <WaveformPlayer audioUrl={previewUrl} audioBlob={previewBlob} />
    </div>
  );
}

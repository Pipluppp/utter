import { Button } from "../../../components/atoms/Button";
import { WaveformPlayer } from "../../../components/organisms/WaveformPlayer";

export interface GenerateResultProps {
  audioUrl: string | null;
  downloadUrl: string | null;
  onDownload: () => void;
}

export function GenerateResult({ audioUrl, downloadUrl, onDownload }: GenerateResultProps) {
  if (!audioUrl) return null;

  return (
    <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium uppercase tracking-wide">Result</div>
        {downloadUrl ? (
          <Button variant="secondary" size="sm" onPress={() => void onDownload()}>
            Download
          </Button>
        ) : null}
      </div>
      <WaveformPlayer audioUrl={audioUrl} />
    </div>
  );
}

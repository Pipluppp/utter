import { Meter } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import { WaveformPlayer } from "../../../components/organisms/WaveformPlayer";
import type { useAudioRecorder } from "../hooks/useAudioRecorder";

type AudioRecorderResult = ReturnType<typeof useAudioRecorder>;

interface RecordPanelProps {
  recorder: AudioRecorderResult;
  file: File | null;
  transcribing: boolean;
  submitting: boolean;
  maxSeconds: number;
  recommendedSeconds: string;
  onStop: () => void;
  onClear: () => void;
}

export function RecordPanel({
  recorder,
  file,
  transcribing,
  submitting,
  maxSeconds,
  recommendedSeconds,
  onStop,
  onClear,
}: RecordPanelProps) {
  const recordTimeMins = Math.floor(recorder.recordSeconds / 60);
  const recordTimeSecs = recorder.recordSeconds % 60;
  const recordTimeLabel = `${recordTimeMins}:${recordTimeSecs.toString().padStart(2, "0")}`;

  const micPercent = Math.min(100, recorder.micLevel * 180);

  return (
    <div className="space-y-4 border border-border bg-background p-6 shadow-elevated">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-wide">Record Reference Audio</div>
        <div className="text-xs text-faint">{recordTimeLabel}</div>
      </div>

      <div className="text-xs text-faint">
        Aim for {recommendedSeconds} seconds. Recording stops automatically at {maxSeconds} seconds.
      </div>

      <Meter
        value={micPercent}
        aria-label="Microphone level"
        className="h-2 w-full overflow-hidden border border-border bg-muted"
      >
        {({ percentage }) => (
          <div
            className="h-full bg-foreground transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        )}
      </Meter>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onPress={() => void recorder.start()}
          isDisabled={recorder.recording || submitting || transcribing}
        >
          {recorder.recording ? "Recording..." : "Start"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onPress={onStop}
          isDisabled={!recorder.recording}
        >
          Stop
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onPress={onClear}
          isDisabled={recorder.recording || transcribing}
        >
          Clear
        </Button>
      </div>

      {transcribing ? (
        <div className="text-xs font-medium uppercase tracking-wide text-faint">
          Transcribing recorded audio...
        </div>
      ) : null}

      {file ? (
        <div className="border border-border bg-background p-3">
          <WaveformPlayer audioBlob={file} />
        </div>
      ) : null}
    </div>
  );
}

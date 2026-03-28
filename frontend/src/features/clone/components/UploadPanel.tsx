import { DropZone, FileTrigger } from "react-aria-components";
import { Button } from "../../../components/atoms/Button";
import { cn } from "../../../lib/cn";

interface UploadPanelProps {
  file: File | null;
  fileInfo: string | null;
  fileError: string | null;
  transcriptionEnabled: boolean;
  transcribing: boolean;
  submitting: boolean;
  onFileSelect: (file: File | null) => Promise<boolean>;
  onTranscribe: () => void;
}

export function UploadPanel({
  file,
  fileInfo,
  fileError,
  transcriptionEnabled,
  transcribing,
  submitting,
  onFileSelect,
  onTranscribe,
}: UploadPanelProps) {
  return (
    <div>
      <DropZone
        aria-label="Drop audio file here"
        className={cn(
          "w-full border border-dashed border-border bg-background p-6 text-center shadow-elevated",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "drop-target:border-ring drop-target:bg-subtle",
        )}
        onDrop={(e) => {
          const fileItem = e.items.find((item) => item.kind === "file");
          if (fileItem && fileItem.kind === "file") {
            void fileItem.getFile().then((f) => onFileSelect(f));
          }
        }}
      >
        <FileTrigger
          acceptedFileTypes={[".wav", ".mp3", ".m4a"]}
          onSelect={(files) => {
            void onFileSelect(files?.[0] ?? null);
          }}
        >
          <Button variant="secondary" type="button" aria-label="Select audio file">
            Browse Files
          </Button>
        </FileTrigger>
        <div className="mt-3 text-sm text-muted-foreground">
          Drag &amp; drop audio here, or click to browse.
        </div>
        <div className="mt-2 text-xs text-faint">WAV / MP3 / M4A - max 10MB - 60s max</div>
        {fileInfo ? <div className="mt-3 text-xs text-foreground">{fileInfo}</div> : null}
        {fileError ? <div className="mt-3 text-xs text-status-error">{fileError}</div> : null}
        {transcriptionEnabled && file ? (
          <Button
            className="mt-3"
            variant="secondary"
            size="sm"
            type="button"
            isPending={transcribing}
            isDisabled={submitting}
            onPress={onTranscribe}
          >
            {transcribing ? "Transcribing..." : "Transcribe"}
          </Button>
        ) : null}
      </DropZone>
    </div>
  );
}

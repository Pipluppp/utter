export type TranscriptionConfig = {
  enabled: boolean;
  provider: "qwen";
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type BatchTranscriptionResult = {
  text: string;
  model: string;
  language: string | null;
};

export class TranscriptionUnavailableError extends Error {
  constructor(message = "Transcription is not configured on this server.") {
    super(message);
    this.name = "TranscriptionUnavailableError";
  }
}

export class TranscriptionUpstreamError extends Error {
  status: number;
  requestId: string | null;

  constructor(status: number, message: string, requestId: string | null = null) {
    super(message);
    this.name = "TranscriptionUpstreamError";
    this.status = status;
    this.requestId = requestId;
  }
}

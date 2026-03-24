import { afterEach, describe, expect, it, vi } from "vitest";
import { setRuntimeEnv } from "../../src/_shared/runtime_env.ts";
import {
    getTranscriptionConfig,
    transcribeAudioFile
} from "../../src/_shared/transcription/provider.ts";

function withMockedFetch(
  handler: typeof fetch,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
    setRuntimeEnv({});
  });
}

describe("transcription_provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes Qwen config defaults", () => {
    setRuntimeEnv({
      DASHSCOPE_API_KEY: "test-key",
      TRANSCRIPTION_ENABLED: "true",
    });

    const config = getTranscriptionConfig();
    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("qwen");
    expect(config.model).toBe("qwen3-asr-flash-2026-02-10");
    expect(config.baseUrl).toBe(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    );

    setRuntimeEnv({});
  });

  it("sends OpenAI-compatible Qwen payload with language hint", async () => {
    setRuntimeEnv({
      DASHSCOPE_API_KEY: "test-key",
      TRANSCRIPTION_ENABLED: "true",
      QWEN_ASR_MODEL: "qwen3-asr-flash-2026-02-10",
      QWEN_ASR_BASE_URL: "https://example.com/compatible-mode/v1",
    });

    let requestUrl = "";
    let requestBody = "";

    await withMockedFetch(
      (async (input, init) => {
        requestUrl = String(input);
        requestBody = String(init?.body ?? "");

        return new Response(
          JSON.stringify({
            model: "qwen3-asr-flash-2026-02-10",
            request_id: "req_success_123",
            usage: { seconds: 1.5 },
            choices: [{
              message: {
                content: "hello from qwen",
                annotations: [{ language: "en" }],
              },
            }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }) as typeof fetch,
      async () => {
        const result = await transcribeAudioFile(
          new File([new Uint8Array([1, 2, 3])], "sample.wav", {
            type: "audio/wav",
          }),
          "English",
        );

        expect(result.text).toBe("hello from qwen");
        expect(result.model).toBe("qwen3-asr-flash-2026-02-10");
        expect(result.language).toBe("en");
        expect(requestUrl).toBe("https://example.com/compatible-mode/v1/chat/completions");

        const body = JSON.parse(requestBody);
        expect(body.model).toBe("qwen3-asr-flash-2026-02-10");
        expect(body.stream).toBe(false);
        expect(body.asr_options.enable_itn).toBe(false);
        expect(body.asr_options.language).toBe("en");
        expect(body.messages.length).toBe(1);
        expect(body.messages[0].role).toBe("user");
        expect(body.messages[0].content[0].type).toBe("input_audio");
        expect(body.messages[0].content[0].input_audio.data).toContain(
          "data:audio/wav;base64,",
        );
      },
    );
  });

  it("omits unknown language hint and parses content arrays", async () => {
    setRuntimeEnv({
      DASHSCOPE_API_KEY: "test-key",
      TRANSCRIPTION_ENABLED: "true",
    });

    let requestBody = "";

    await withMockedFetch(
      (async (_input, init) => {
        requestBody = String(init?.body ?? "");

        return new Response(
          JSON.stringify({
            choices: [{
              message: {
                content: [{ text: "array transcript" }],
              },
            }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }) as typeof fetch,
      async () => {
        const result = await transcribeAudioFile(
          new File([new Uint8Array([1, 2, 3])], "sample.m4a", {
            type: "audio/mp4",
          }),
          "Auto",
        );

        expect(result.text).toBe("array transcript");
        expect(result.model).toBe("qwen3-asr-flash-2026-02-10");
        expect(result.language).toBe(null);

        const body = JSON.parse(requestBody);
        expect("language" in body.asr_options).toBe(false);
      },
    );
  });

  it("surfaces upstream failures as TranscriptionUpstreamError", async () => {
    setRuntimeEnv({
      DASHSCOPE_API_KEY: "test-key",
      TRANSCRIPTION_ENABLED: "true",
    });

    await withMockedFetch(
      (async () =>
        new Response(
          JSON.stringify({
            request_id: "req_error_123",
            message: "bad audio payload",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )) as typeof fetch,
      async () => {
        await expect(
          () =>
            transcribeAudioFile(
              new File([new Uint8Array([1, 2, 3])], "sample.wav", {
                type: "audio/wav",
              }),
              "English",
            ),
        ).rejects.toThrow("Qwen transcription failed (400): bad audio payload");
      },
    );
  });
});

import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  getTranscriptionConfig,
  TranscriptionUpstreamError,
  transcribeAudioFile,
} from "../src/_shared/transcription/provider.ts";
import { setRuntimeEnv } from "../src/_shared/runtime_env.ts";

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

Deno.test("transcription provider exposes Qwen config defaults", () => {
  setRuntimeEnv({
    DASHSCOPE_API_KEY: "test-key",
    TRANSCRIPTION_ENABLED: "true",
  });

  const config = getTranscriptionConfig();
  assertEquals(config.enabled, true);
  assertEquals(config.provider, "qwen");
  assertEquals(config.model, "qwen3-asr-flash-2026-02-10");
  assertEquals(
    config.baseUrl,
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  );

  setRuntimeEnv({});
});

Deno.test({
  name: "transcription provider sends OpenAI-compatible Qwen payload with language hint",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
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

        assertEquals(result.text, "hello from qwen");
        assertEquals(result.model, "qwen3-asr-flash-2026-02-10");
        assertEquals(result.language, "en");
        assertEquals(requestUrl, "https://example.com/compatible-mode/v1/chat/completions");

        const body = JSON.parse(requestBody);
        assertEquals(body.model, "qwen3-asr-flash-2026-02-10");
        assertEquals(body.stream, false);
        assertEquals(body.asr_options.enable_itn, false);
        assertEquals(body.asr_options.language, "en");
        assertEquals(body.messages.length, 1);
        assertEquals(body.messages[0].role, "user");
        assertEquals(body.messages[0].content[0].type, "input_audio");
        assertStringIncludes(
          body.messages[0].content[0].input_audio.data,
          "data:audio/wav;base64,",
        );
      },
    );
  },
});

Deno.test({
  name: "transcription provider omits unknown language hint and parses content arrays",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
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

        assertEquals(result.text, "array transcript");
        assertEquals(result.model, "qwen3-asr-flash-2026-02-10");
        assertEquals(result.language, null);

        const body = JSON.parse(requestBody);
        assertEquals("language" in body.asr_options, false);
      },
    );
  },
});

Deno.test({
  name: "transcription provider surfaces upstream failures as TranscriptionUpstreamError",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
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
        await assertRejects(
          () =>
            transcribeAudioFile(
              new File([new Uint8Array([1, 2, 3])], "sample.wav", {
                type: "audio/wav",
              }),
              "English",
            ),
          TranscriptionUpstreamError,
          "Qwen transcription failed (400): bad audio payload",
        );
      },
    );
  },
});

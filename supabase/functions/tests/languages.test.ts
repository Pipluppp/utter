import { assertArrayIncludes, assertEquals } from "@std/assert";
import { apiPublicFetch } from "./_helpers/setup.ts";

Deno.test("GET /languages returns language list with defaults", async () => {
  const res = await apiPublicFetch("/languages");
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.default, "Auto");
  assertEquals(body.provider, "modal");
  assertEquals(Array.isArray(body.languages), true);
  assertArrayIncludes(body.languages, ["Auto", "English", "Chinese"]);
  assertEquals(body.capabilities.supports_generate, true);
  assertEquals(body.capabilities.supports_generate_stream, false);
  assertEquals(body.capabilities.default_generate_mode, "task");
  assertEquals(body.capabilities.allow_generate_mode_toggle, false);
  assertEquals(typeof body.capabilities.max_text_chars, "number");
});

Deno.test("GET /languages includes transcription config", async () => {
  const res = await apiPublicFetch("/languages");
  const body = await res.json();

  assertEquals(body.transcription.provider, "mistral");
  assertEquals(typeof body.transcription.enabled, "boolean");
  assertEquals(typeof body.transcription.model, "string");
});

Deno.test("GET /languages works without auth", async () => {
  const res = await apiPublicFetch("/languages");
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

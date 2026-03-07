import { assertEquals } from "@std/assert";
import { apiPublicFetch } from "./_helpers/setup.ts";

Deno.test("GET /health returns { ok: true }", async () => {
  const res = await apiPublicFetch("/health");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
});

Deno.test("GET /health works without auth", async () => {
  const res = await apiPublicFetch("/health");
  assertEquals(res.status, 200);
  await res.body?.cancel();
});

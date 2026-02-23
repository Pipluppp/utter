/**
 * /credits endpoint tests.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  apiFetch,
  apiPublicFetch,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./_helpers/setup.ts";
import { TEST_USER_A } from "./_helpers/fixtures.ts";

let userA: TestUser;

Deno.test({
  name: "credits: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  },
});

Deno.test("GET /credits/usage returns usage summary payload", async () => {
  const res = await apiFetch("/credits/usage", userA.accessToken);
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.credit_unit, "1 credit = 1 character");
  assertEquals(typeof body.window_days, "number");
  assertExists(body.plan);
  assertEquals(typeof body.plan.tier, "string");
  assertEquals(typeof body.plan.monthly_credits, "number");
  assertEquals(typeof body.balance, "number");
  assertEquals(typeof body.usage.debited, "number");
  assertEquals(typeof body.usage.credited, "number");
  assertEquals(typeof body.usage.net, "number");
  assertEquals(Array.isArray(body.rate_card), true);
  assertEquals(Array.isArray(body.events), true);
});

Deno.test("GET /credits/usage requires auth", async () => {
  const res = await apiPublicFetch("/credits/usage");
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test({
  name: "credits: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await deleteTestUser(userA.userId);
  },
});

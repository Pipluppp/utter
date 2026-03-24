/** Reusable factory helpers for integration tests */
import { createClient } from "@supabase/supabase-js";
import {
    createTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./setup.ts";

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/**
 * Create a test user and seed their profile with the given balance / trial counts.
 * Wraps `createTestUser` + an admin profile upsert in a single call.
 */
export async function createUserWithBalance(opts: {
  email: string;
  password?: string;
  credits: number;
  designTrials?: number;
  cloneTrials?: number;
  tier?: string;
}): Promise<TestUser> {
  const user = await createTestUser(opts.email, opts.password ?? "testpass123!");
  const admin = getAdminClient();
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.userId,
        credits_remaining: opts.credits,
        design_trials_remaining: opts.designTrials ?? 2,
        clone_trials_remaining: opts.cloneTrials ?? 2,
        subscription_tier: opts.tier ?? "free",
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(`createUserWithBalance profile upsert failed: ${error.message}`);
  return user;
}

/**
 * Remove all test artifacts for a user across common tables.
 * Logs but does not throw on individual table failures to avoid masking the actual test failure.
 */
export async function cleanupUserArtifacts(userId: string): Promise<void> {
  const admin = getAdminClient();
  const tables = ["generations", "tasks", "voices", "trial_consumption", "credit_ledger"];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) console.warn(`cleanupUserArtifacts: failed to clean ${table} for ${userId}: ${error.message}`);
  }
}

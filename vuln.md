# Vulnerability: IDOR — Voice Mutation via Admin Client Without `user_id` Guard

## Severity: HIGH (Broken Access Control / CWE-639)

## Summary

The `PATCH /voices/:id/favorite` and `PATCH /voices/:id/name` endpoints perform
write operations using the Supabase **admin client** (service role key, bypasses
all Row Level Security) without filtering by `user_id`. The admin UPDATE will
succeed for **any** voice row in the database regardless of ownership.

A preceding SELECT via the user client (RLS-enforced) currently gates access, so
the vulnerability is **not directly exploitable today**. However, the admin
mutation is genuinely unguarded, `userId` is never even captured in these
handlers, and the adjacent DELETE endpoint proves the omission is an oversight.

## Verified Execution Flow

### Prerequisite: RLS policy state after all migrations

| Policy | Operation | Predicate | Status |
|---|---|---|---|
| `voices_select_own` | SELECT | `auth.uid() = user_id` | **Active** |
| `voices_delete_own` | DELETE | `auth.uid() = user_id` | **Active** |
| `voices_insert_own` | INSERT | — | **Dropped** (migration `20260212`) |
| (none) | UPDATE | — | Never created; `UPDATE` revoked from `authenticated` |

All voice writes (INSERT/UPDATE) go through the service role admin client, which
bypasses RLS entirely. There are no policies that widen SELECT visibility beyond
own-user rows.

### PATCH /voices/:id/favorite — step-by-step trace

| Step | Line | Client | What happens |
|---|---|---|---|
| 1 | 203 | — | `requireUser(c.req.raw)` → authenticates, returns `{ supabase }`. **`userId` is discarded.** |
| 2 | 210-214 | user (RLS ON) | `supabase.from("voices").select(…).eq("id", voiceId).maybeSingle()` — `voices_select_own` adds `WHERE auth.uid() = user_id`. Cross-user → null → 404. |
| 3 | 219-220 | — | Soft-delete check: if `deleted_at` set → 404. |
| 4 | 222-228 | **admin (RLS OFF)** | `admin.from("voices").update({ is_favorite }).eq("id", voiceId).select().maybeSingle()` — **no `.eq("user_id", …)`** filter. The bare `.select()` also returns **all columns** (including `reference_object_key`, `provider_voice_id`, etc.). |

### PATCH /voices/:id/name — same pattern

| Step | Line | Client | What happens |
|---|---|---|---|
| 1 | 238 | — | `requireUser` → `{ supabase }`. **`userId` discarded again.** |
| 2 | 251-255 | user (RLS ON) | RLS SELECT gate — cross-user → null → 404. |
| 3 | 263-269 | **admin (RLS OFF)** | `admin.from("voices").update({ name }).eq("id", voiceId).select().maybeSingle()` — **no `user_id` filter.** |

### DELETE /voices/:id — correct reference implementation

| Step | Line | Client | What happens |
|---|---|---|---|
| 1 | 280 | — | `requireUser` → captures **both** `userId` **and** `supabase`. |
| 2 | 289-293 | user (RLS ON) | RLS SELECT gate. |
| 3 | 302-307 | **admin (RLS OFF)** | `.eq("id", voiceId).eq("user_id", userId)` — **`user_id` present.** |

The DELETE handler is the proof-of-intent: the developer knew the admin client
needs an explicit `user_id` guard, but didn't apply it to the two PATCH handlers.

## Why the RLS gate is not sufficient

1. **No `userId` in scope.** Both PATCH handlers destructure only `{ supabase }`
   from `requireUser`. `userId` is not captured at all — the guard *cannot* be
   added without also fixing the destructuring. This isn't "defense in depth
   with a missing belt"; the belt physically doesn't exist.

2. **Trust-context mismatch.** The authorization check (user client, RLS ON) and
   the mutation (admin client, RLS OFF) operate in different trust contexts.
   The admin client's purpose is to bypass RLS — any code path that uses it must
   independently verify authorization.

3. **One policy change away from critical.** The only surviving SELECT policy is
   `voices_select_own` (`auth.uid() = user_id`). If any future feature adds a
   broader SELECT policy (shared voices, team workspaces, public voice
   marketplace), the RLS gate on the PATCH endpoints evaporates, and the
   unguarded admin UPDATE becomes exploitable for arbitrary cross-user voice
   mutation.

4. **Data leakage amplifier.** The admin UPDATE uses bare `.select()` (no column
   list), which returns every column including `reference_object_key`,
   `provider_voice_id`, `provider_target_model`, and `provider_metadata`. If
   the IDOR became exploitable, the response would leak internal provider
   metadata.

## Exploit Scenario (requires one additional SELECT policy)

```bash
# Attacker (User A) renames User B's voice
curl -X PATCH https://utter-wheat.vercel.app/api/voices/<USER_B_VOICE_ID>/name \
  -H "Authorization: Bearer <USER_A_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name": "pwned"}'
```

The admin UPDATE at line 265 would execute (via PostgREST service role):
```sql
UPDATE voices SET name = 'pwned' WHERE id = '<USER_B_VOICE_ID>';
-- No user_id filter. Succeeds for ANY voice.
```

## Fix

**Step 1:** Capture `userId` in both PATCH handlers (matching the DELETE pattern):

```diff
- let supabase: ReturnType<typeof createUserClient>;
+ let userId: string;
+ let supabase: ReturnType<typeof createUserClient>;
  try {
-   ({ supabase } = await requireUser(c.req.raw));
+   const { user, supabase: userClient } = await requireUser(c.req.raw);
+   userId = user.id;
+   supabase = userClient;
  } catch (e) {
```

**Step 2:** Add `user_id` filter to both admin UPDATEs:

```diff
  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("voices")
    .update({ is_favorite: !row.is_favorite })
    .eq("id", voiceId)
+   .eq("user_id", userId)
    .select()
    .maybeSingle();
```

```diff
  const admin = createAdminClient();
  const { data: updated, error: updateError } = await admin
    .from("voices")
    .update({ name })
    .eq("id", voiceId)
+   .eq("user_id", userId)
    .select()
    .maybeSingle();
```

---

## Additional Finding: Timing Attack on Service Role Key

**Severity:** MEDIUM (CWE-208: Observable Timing Discrepancy)

**File:** `workers/api/src/routes/storage.ts`, line 98

```ts
function requireServiceRole(req: Request): Response | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return jsonDetail("Missing or malformed Authorization header.", 403);
  }
  const token = header.slice("Bearer ".length).trim();
  const serviceRoleKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || token !== serviceRoleKey) {   // <-- non-constant-time
    return jsonDetail("Invalid service-role key.", 403);
  }
  return null;
}
```

### Verified details

- **Comparison method:** JavaScript `!==` short-circuits on the first differing
  character (or on length mismatch). This leaks timing information proportional
  to the number of matching prefix characters.

- **Same codebase has the fix:** `_shared/storage.ts:129-136` defines a
  `secureCompare` function using XOR accumulation — the correct constant-time
  pattern. It is used for HMAC token verification but not here.

- **What it protects:** The `/storage/admin/*` routes — upload, list, head,
  remove for both R2 buckets. Plus the key itself is `SUPABASE_SERVICE_ROLE_KEY`,
  which bypasses all RLS when used with `createAdminClient()`.

- **Practical exploitability:** Cloudflare Workers have low and relatively stable
  per-request latency, which reduces noise in timing measurements compared to
  traditional servers. A Supabase service role key is a JWT with a predictable
  `eyJ` prefix (~36 known chars), reducing the search space. However, extracting
  the remaining ~130 characters still requires a statistically significant number
  of requests per position — making this a persistent, low-rate attack rather
  than a quick exploit.

### Fix

Replace `!==` with the existing `secureCompare` (export it from `_shared/storage.ts`):

```diff
+ import { secureCompare } from "../_shared/storage.ts";

  function requireServiceRole(req: Request): Response | null {
    ...
    const serviceRoleKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
-   if (!serviceRoleKey || token !== serviceRoleKey) {
+   if (!serviceRoleKey || !secureCompare(token, serviceRoleKey)) {
      return jsonDetail("Invalid service-role key.", 403);
    }
    return null;
  }
```

# Task 2: Profile Column Guards

## Problem

The `profiles` table has server-owned fields that clients must not be able to modify directly:

- `credits_remaining` — monetary value, controls usage limits
- `subscription_tier` — determines feature access and credit allocation
- `total_generations`, `total_clones` — usage counters

Current RLS policy allows authenticated users to update their own row, but does **not restrict which columns** they can write to. A malicious client could call PostgREST directly:

```bash
curl -X PATCH \
  'https://jgmivviwockcwjkvpqra.supabase.co/rest/v1/profiles?id=eq.USER_ID' \
  -H 'Authorization: Bearer USER_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"credits_remaining": 999999, "subscription_tier": "enterprise"}'
```

This would succeed under current RLS because the user owns the row.

## Solution

Add a `BEFORE UPDATE` trigger that rejects writes to server-owned columns unless the caller is using the `service_role` key (which only edge functions have).

This approach is documented in `docs/supabase-security.md` (section 3b, lines 86-112).

## Implementation

### 1. Create migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_profile_column_guards.sql

-- Prevent clients from modifying server-owned columns on profiles.
-- Only service_role (edge functions) can update these fields.
CREATE OR REPLACE FUNCTION guard_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role bypasses this check (edge functions use service_role)
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For anon/authenticated callers, prevent changes to server-owned columns
  IF NEW.credits_remaining IS DISTINCT FROM OLD.credits_remaining THEN
    RAISE EXCEPTION 'cannot modify credits_remaining';
  END IF;

  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'cannot modify subscription_tier';
  END IF;

  IF NEW.total_generations IS DISTINCT FROM OLD.total_generations THEN
    RAISE EXCEPTION 'cannot modify total_generations';
  END IF;

  IF NEW.total_clones IS DISTINCT FROM OLD.total_clones THEN
    RAISE EXCEPTION 'cannot modify total_clones';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_profile_columns();
```

### 2. Verify existing columns

Before writing the migration, confirm which server-owned columns actually exist on `profiles` today. Check:

```bash
supabase db dump --schema public | grep -A 30 "CREATE TABLE.*profiles"
```

Adjust the trigger to match only columns that exist. If `credits_remaining` / `subscription_tier` don't exist yet, the migration should add them first.

### 3. Add pgTAP tests

```sql
-- supabase/tests/profile_column_guards_test.sql

BEGIN;
SELECT plan(4);

-- Setup: insert a test user profile
INSERT INTO auth.users (id, email) VALUES ('test-guard-user', 'guard@test.com');
INSERT INTO profiles (id) VALUES ('test-guard-user');

-- Test 1: authenticated user cannot update credits_remaining
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "test-guard-user", "role": "authenticated"}';

SELECT throws_ok(
  $$UPDATE profiles SET credits_remaining = 999 WHERE id = 'test-guard-user'$$,
  'cannot modify credits_remaining'
);

-- Test 2: authenticated user cannot update subscription_tier
SELECT throws_ok(
  $$UPDATE profiles SET subscription_tier = 'enterprise' WHERE id = 'test-guard-user'$$,
  'cannot modify subscription_tier'
);

-- Test 3: authenticated user CAN update display_name (allowed column)
SELECT lives_ok(
  $$UPDATE profiles SET display_name = 'New Name' WHERE id = 'test-guard-user'$$
);

-- Test 4: service_role CAN update credits_remaining
RESET role;
SET LOCAL role TO service_role;
SET LOCAL request.jwt.claims TO '{"role": "service_role"}';

SELECT lives_ok(
  $$UPDATE profiles SET credits_remaining = 500 WHERE id = 'test-guard-user'$$
);

SELECT * FROM finish();
ROLLBACK;
```

### 4. Deploy

```bash
# Generate migration with timestamp
supabase migration new profile_column_guards

# Test locally
supabase db reset
npm run test:db

# Push to remote
supabase db push
```

## Acceptance criteria

- [ ] Authenticated users can update `display_name`, `handle`, `avatar_url`
- [ ] Authenticated users get an error updating `credits_remaining`, `subscription_tier`, `total_generations`, `total_clones`
- [ ] Edge functions (service_role) can update all columns
- [ ] pgTAP tests pass locally and in CI
- [ ] Migration deployed to `utter-dev` project

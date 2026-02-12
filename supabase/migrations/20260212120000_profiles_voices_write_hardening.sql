-- Phase 08c: harden direct PostgREST writes for server-owned fields.
-- Ref: docs/supabase-security.md §3b (profiles column tampering) and §6 (storage object key safety).

-- Profiles writes should go through trusted server paths (/api/profile or RPC).
revoke update on public.profiles from authenticated;
drop policy if exists "profiles_update_own" on public.profiles;

-- Voices rows contain server-owned storage keys. Prevent direct client INSERT tampering.
revoke insert on public.voices from authenticated;
drop policy if exists "voices_insert_own" on public.voices;

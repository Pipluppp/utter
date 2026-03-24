-- ==========================================================================
-- 07_grants.sql — All REVOKE and GRANT statements (cumulative end-state)
--
-- Organized by concern: tables, sequences, functions.
-- This file is last in schema_paths because it references all prior objects.
--
-- NOTE: The Supabase declarative diff tool (migra) has known quirks with
-- grants — it may produce duplicate GRANT statements due to default
-- privilege interactions. Always review generated diffs manually.
-- ==========================================================================

-- ============================================================
-- TABLE GRANTS — core app tables (authenticated read/write hardening)
-- ============================================================

-- Generations: edge-only writes (authenticated gets SELECT + DELETE via RLS)
revoke insert, update on public.generations from authenticated;

-- Tasks: edge-only everything (authenticated gets SELECT via RLS only)
revoke insert, update, delete on public.tasks from authenticated;

-- Profiles: all writes go through trusted server paths
revoke update on public.profiles from authenticated;

-- Voices: no client INSERT or UPDATE (server-owned storage keys)
revoke insert on public.voices from authenticated;
revoke update on public.voices from authenticated;

-- Anon role: no writes on any core table
revoke insert, update, delete on public.profiles from anon;
revoke insert, update, delete on public.voices from anon;
revoke insert, update, delete on public.generations from anon;
revoke insert, update, delete on public.tasks from anon;

-- ============================================================
-- TABLE GRANTS — service-role-only tables
-- ============================================================

-- credit_ledger
revoke all on public.credit_ledger from public;
revoke all on public.credit_ledger from anon;
revoke all on public.credit_ledger from authenticated;
grant select on public.credit_ledger to authenticated;
grant select, insert, update, delete on public.credit_ledger to service_role;

-- trial_consumption
revoke all on public.trial_consumption from public;
revoke all on public.trial_consumption from anon;
revoke all on public.trial_consumption from authenticated;
grant select, insert, update, delete on public.trial_consumption to service_role;

-- billing_events
revoke all on public.billing_events from public;
revoke all on public.billing_events from anon;
revoke all on public.billing_events from authenticated;
grant select, insert, update, delete on public.billing_events to service_role;

-- rate_limit_counters
revoke all on public.rate_limit_counters from public;
revoke all on public.rate_limit_counters from anon;
revoke all on public.rate_limit_counters from authenticated;
grant select, insert, update, delete on public.rate_limit_counters to service_role;

-- ============================================================
-- SEQUENCE GRANTS — service-role-only sequences
-- ============================================================

revoke all on sequence public.credit_ledger_id_seq from public;
revoke all on sequence public.credit_ledger_id_seq from anon;
revoke all on sequence public.credit_ledger_id_seq from authenticated;
grant usage, select on sequence public.credit_ledger_id_seq to service_role;

revoke all on sequence public.trial_consumption_id_seq from public;
revoke all on sequence public.trial_consumption_id_seq from anon;
revoke all on sequence public.trial_consumption_id_seq from authenticated;
grant usage, select on sequence public.trial_consumption_id_seq to service_role;

revoke all on sequence public.billing_events_id_seq from public;
revoke all on sequence public.billing_events_id_seq from anon;
revoke all on sequence public.billing_events_id_seq from authenticated;
grant usage, select on sequence public.billing_events_id_seq to service_role;

revoke all on sequence public.rate_limit_counters_id_seq from public;
revoke all on sequence public.rate_limit_counters_id_seq from anon;
revoke all on sequence public.rate_limit_counters_id_seq from authenticated;
grant usage, select on sequence public.rate_limit_counters_id_seq to service_role;

-- ============================================================
-- FUNCTION GRANTS — all 7 functions locked to service_role
-- ============================================================

-- 1. handle_updated_at()
revoke all on function public.handle_updated_at() from public;
revoke execute on function public.handle_updated_at() from anon;
revoke execute on function public.handle_updated_at() from authenticated;
grant execute on function public.handle_updated_at() to service_role;

-- 2. handle_new_user()
revoke all on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.handle_new_user() to service_role;

-- 3. credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb)
revoke all on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from public;
revoke execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from anon;
revoke execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from authenticated;
grant execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) to service_role;

-- 4. credit_usage_window_totals(uuid, timestamptz)
revoke all on function public.credit_usage_window_totals(uuid, timestamptz) from public;
revoke execute on function public.credit_usage_window_totals(uuid, timestamptz) from anon;
revoke execute on function public.credit_usage_window_totals(uuid, timestamptz) from authenticated;
grant execute on function public.credit_usage_window_totals(uuid, timestamptz) to service_role;

-- 5. trial_or_debit(uuid, text, integer, text, uuid, text, jsonb)
revoke all on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from public;
revoke execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from anon;
revoke execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from authenticated;
grant execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) to service_role;

-- 6. trial_restore(uuid, text, text, jsonb)
revoke all on function public.trial_restore(uuid, text, text, jsonb) from public;
revoke execute on function public.trial_restore(uuid, text, text, jsonb) from anon;
revoke execute on function public.trial_restore(uuid, text, text, jsonb) from authenticated;
grant execute on function public.trial_restore(uuid, text, text, jsonb) to service_role;

-- 7. rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz)
revoke all on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from public;
revoke execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from anon;
revoke execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) to service_role;

-- ==========================================================================
-- 05_rls_policies.sql — Row Level Security for all public schema tables
-- ==========================================================================
--
-- NOTE: Modifying a policy in this file will cause `supabase db diff` to
-- generate DROP POLICY + CREATE POLICY (not ALTER POLICY). The diff tool
-- (migra) does not support ALTER POLICY, so any policy change results in
-- a drop-and-recreate migration. During the brief window between DROP and
-- CREATE the policy does not exist, which means zero access (safe-by-default
-- for RLS-enabled tables).
--

-- ============================================================
-- Enable RLS on all public tables
-- ============================================================

alter table public.profiles enable row level security;
alter table public.voices enable row level security;
alter table public.generations enable row level security;
alter table public.tasks enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.trial_consumption enable row level security;
alter table public.billing_events enable row level security;
alter table public.rate_limit_counters enable row level security;

-- ============================================================
-- profiles
-- ============================================================

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

-- ============================================================
-- voices
-- ============================================================

create policy voices_select_own on public.voices
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy voices_delete_own on public.voices
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- generations
-- ============================================================

create policy generations_select_own on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy generations_delete_own on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- tasks
-- ============================================================

create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ============================================================
-- credit_ledger
-- ============================================================

create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy credit_ledger_service_role_all on public.credit_ledger
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- trial_consumption
-- ============================================================

create policy trial_consumption_service_role_all on public.trial_consumption
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- billing_events
-- ============================================================

create policy billing_events_service_role_all on public.billing_events
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- rate_limit_counters
-- ============================================================

create policy rate_limit_counters_service_role_all on public.rate_limit_counters
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

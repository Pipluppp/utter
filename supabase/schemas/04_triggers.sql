-- ==========================================================================
-- 04_triggers.sql — All trigger definitions (3 total)
--
-- Uses CREATE TRIGGER (not CREATE OR REPLACE TRIGGER).
-- Depends on tables (01_tables.sql) and functions (03_functions.sql).
-- ==========================================================================

-- ------------------------------------------------------------
-- Auto-update updated_at on row changes
-- ------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------
-- Auto-create profile row when a new user signs up
-- ------------------------------------------------------------

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hardening: new accounts should not receive free credits or trials by default.

alter table public.profiles
  alter column credits_remaining set default 0,
  alter column design_trials_remaining set default 0,
  alter column clone_trials_remaining set default 0;

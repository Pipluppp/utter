-- Security hardening: explicit RLS policy for internal rate-limit counters table.
-- Table remains server-only: grants + policy allow service_role, deny anon/authenticated.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limit_counters'
      and policyname = 'rate_limit_counters_service_role_all'
  ) then
    create policy rate_limit_counters_service_role_all
      on public.rate_limit_counters
      as permissive
      for all
      to service_role
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

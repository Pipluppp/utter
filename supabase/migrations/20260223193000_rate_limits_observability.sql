-- Security hardening: durable API rate-limits + explicit RPC grants.

create table if not exists public.rate_limit_counters (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('user', 'ip')),
  actor_key text not null check (char_length(actor_key) between 1 and 128),
  tier text not null check (tier in ('tier1', 'tier2', 'tier3')),
  window_seconds integer not null check (window_seconds > 0),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (actor_type, actor_key, tier, window_seconds, window_start)
);

create index if not exists idx_rate_limit_counters_lookup
  on public.rate_limit_counters (actor_type, actor_key, tier, window_seconds, window_start);

create index if not exists idx_rate_limit_counters_window_start
  on public.rate_limit_counters (window_start);

alter table public.rate_limit_counters enable row level security;

revoke all on public.rate_limit_counters from public;
revoke all on public.rate_limit_counters from anon;
revoke all on public.rate_limit_counters from authenticated;
grant select, insert, update, delete on public.rate_limit_counters to service_role;

revoke all on sequence public.rate_limit_counters_id_seq from public;
revoke all on sequence public.rate_limit_counters_id_seq from anon;
revoke all on sequence public.rate_limit_counters_id_seq from authenticated;
grant usage, select on sequence public.rate_limit_counters_id_seq to service_role;

create or replace function public.rate_limit_check_and_increment(
  p_actor_type text,
  p_actor_key text,
  p_tier text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
) returns table (
  allowed boolean,
  current_count integer,
  limit_value integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_elapsed integer;
begin
  if p_actor_type not in ('user', 'ip') then
    raise exception 'invalid actor_type: %', p_actor_type using errcode = '22023';
  end if;

  if p_tier not in ('tier1', 'tier2', 'tier3') then
    raise exception 'invalid tier: %', p_tier using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be >= 1' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds must be >= 1' using errcode = '22023';
  end if;

  if p_actor_key is null or btrim(p_actor_key) = '' then
    raise exception 'p_actor_key is required' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (
    actor_type,
    actor_key,
    tier,
    window_seconds,
    window_start,
    request_count,
    created_at,
    updated_at
  )
  values (
    p_actor_type,
    p_actor_key,
    p_tier,
    p_window_seconds,
    v_window_start,
    1,
    p_now,
    p_now
  )
  on conflict (actor_type, actor_key, tier, window_seconds, window_start)
  do update
    set request_count = public.rate_limit_counters.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into v_count;

  allowed := v_count <= p_limit;
  current_count := v_count;
  limit_value := p_limit;

  if allowed then
    retry_after_seconds := 0;
  else
    v_elapsed := greatest(0, extract(epoch from (p_now - v_window_start))::integer);
    retry_after_seconds := greatest(1, p_window_seconds - v_elapsed);
  end if;

  return next;
end;
$$;

revoke all on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from public;
revoke execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from anon;
revoke execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.rate_limit_check_and_increment(text, text, text, integer, integer, timestamptz) to service_role;

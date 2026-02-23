-- Credits foundation: immutable ledger + atomic debit/refund RPC.

create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_kind text not null check (event_kind in ('debit', 'refund', 'grant', 'adjustment')),
  operation text not null check (operation in ('generate', 'design_preview', 'clone', 'monthly_allocation', 'manual_adjustment')),
  amount integer not null check (amount > 0),
  signed_amount integer not null check (signed_amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  reference_type text not null check (reference_type in ('task', 'generation', 'voice', 'profile', 'system')),
  reference_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists idx_credit_ledger_user_created
  on public.credit_ledger (user_id, created_at desc, id desc);

create index if not exists idx_credit_ledger_reference
  on public.credit_ledger (reference_type, reference_id)
  where reference_id is not null;

alter table public.credit_ledger enable row level security;

drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists credit_ledger_service_role_all on public.credit_ledger;
create policy credit_ledger_service_role_all on public.credit_ledger
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.credit_ledger from public;
revoke all on public.credit_ledger from anon;
revoke all on public.credit_ledger from authenticated;
grant select on public.credit_ledger to authenticated;
grant select, insert, update, delete on public.credit_ledger to service_role;

revoke all on sequence public.credit_ledger_id_seq from public;
revoke all on sequence public.credit_ledger_id_seq from anon;
revoke all on sequence public.credit_ledger_id_seq from authenticated;
grant usage, select on sequence public.credit_ledger_id_seq to service_role;

create or replace function public.credit_apply_event(
  p_user_id uuid,
  p_event_kind text,
  p_operation text,
  p_amount integer,
  p_reference_type text,
  p_reference_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  applied boolean,
  duplicate boolean,
  insufficient boolean,
  balance_remaining integer,
  ledger_id bigint,
  signed_amount integer,
  event_kind text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_existing public.credit_ledger%rowtype;
  v_signed integer;
  v_key text;
  v_metadata jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if p_event_kind not in ('debit', 'refund', 'grant', 'adjustment') then
    raise exception 'invalid p_event_kind: %', p_event_kind using errcode = '22023';
  end if;

  if p_operation not in ('generate', 'design_preview', 'clone', 'monthly_allocation', 'manual_adjustment') then
    raise exception 'invalid p_operation: %', p_operation using errcode = '22023';
  end if;

  if p_reference_type not in ('task', 'generation', 'voice', 'profile', 'system') then
    raise exception 'invalid p_reference_type: %', p_reference_type using errcode = '22023';
  end if;

  if p_amount is null or p_amount < 1 then
    raise exception 'p_amount must be >= 1' using errcode = '22023';
  end if;

  v_key := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  if v_key is null then
    raise exception 'p_idempotency_key is required' using errcode = '22023';
  end if;

  if char_length(v_key) > 128 then
    raise exception 'p_idempotency_key is too long' using errcode = '22023';
  end if;

  v_metadata := coalesce(p_metadata, '{}'::jsonb);
  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'p_metadata must be a JSON object' using errcode = '22023';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found for user %', p_user_id using errcode = '23503';
  end if;

  select *
  into v_existing
  from public.credit_ledger
  where user_id = p_user_id
    and idempotency_key = v_key
  limit 1;

  if found then
    applied := false;
    duplicate := true;
    insufficient := false;
    balance_remaining := v_existing.balance_after;
    ledger_id := v_existing.id;
    signed_amount := v_existing.signed_amount;
    event_kind := v_existing.event_kind;
    return next;
    return;
  end if;

  v_signed := case
    when p_event_kind = 'debit' then -p_amount
    else p_amount
  end;

  if (v_profile.credits_remaining + v_signed) < 0 then
    applied := false;
    duplicate := false;
    insufficient := true;
    balance_remaining := v_profile.credits_remaining;
    ledger_id := null;
    signed_amount := v_signed;
    event_kind := p_event_kind;
    return next;
    return;
  end if;

  update public.profiles
  set credits_remaining = credits_remaining + v_signed
  where id = p_user_id
  returning * into v_profile;

  insert into public.credit_ledger (
    user_id,
    event_kind,
    operation,
    amount,
    signed_amount,
    balance_after,
    reference_type,
    reference_id,
    idempotency_key,
    metadata
  )
  values (
    p_user_id,
    p_event_kind,
    p_operation,
    p_amount,
    v_signed,
    v_profile.credits_remaining,
    p_reference_type,
    p_reference_id,
    v_key,
    v_metadata
  )
  returning id into ledger_id;

  applied := true;
  duplicate := false;
  insufficient := false;
  balance_remaining := v_profile.credits_remaining;
  signed_amount := v_signed;
  event_kind := p_event_kind;

  return next;
end;
$$;

revoke all on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from public;
revoke execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from anon;
revoke execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) from authenticated;
grant execute on function public.credit_apply_event(uuid, text, text, integer, text, uuid, text, jsonb) to service_role;

create or replace function public.credit_usage_window_totals(
  p_user_id uuid,
  p_since timestamptz default (now() - interval '30 days')
) returns table (
  total_debited integer,
  total_credited integer,
  net_signed integer
)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(sum(case when signed_amount < 0 then -signed_amount else 0 end), 0)::integer as total_debited,
    coalesce(sum(case when signed_amount > 0 then signed_amount else 0 end), 0)::integer as total_credited,
    coalesce(sum(signed_amount), 0)::integer as net_signed
  from public.credit_ledger
  where user_id = p_user_id
    and created_at >= p_since;
$$;

revoke all on function public.credit_usage_window_totals(uuid, timestamptz) from public;
revoke execute on function public.credit_usage_window_totals(uuid, timestamptz) from anon;
revoke execute on function public.credit_usage_window_totals(uuid, timestamptz) from authenticated;
grant execute on function public.credit_usage_window_totals(uuid, timestamptz) to service_role;

insert into public.credit_ledger (
  user_id,
  event_kind,
  operation,
  amount,
  signed_amount,
  balance_after,
  reference_type,
  reference_id,
  idempotency_key,
  metadata
)
select
  p.id,
  'grant',
  'monthly_allocation',
  p.credits_remaining,
  p.credits_remaining,
  p.credits_remaining,
  'profile',
  p.id,
  'migration-20260224-initial-balance',
  jsonb_build_object(
    'source', 'migration',
    'migration', '20260224001500_credits_ledger_foundation'
  )
from public.profiles p
where p.credits_remaining > 0
on conflict (user_id, idempotency_key) do nothing;

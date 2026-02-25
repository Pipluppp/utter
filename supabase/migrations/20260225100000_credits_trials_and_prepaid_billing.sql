-- Credits phase: trial-first pricing + prepaid billing support.

alter table public.profiles
  add column if not exists design_trials_remaining integer not null default 2,
  add column if not exists clone_trials_remaining integer not null default 2;

alter table public.profiles
  drop constraint if exists profiles_design_trials_remaining_check,
  drop constraint if exists profiles_clone_trials_remaining_check;

alter table public.profiles
  add constraint profiles_design_trials_remaining_check
    check (design_trials_remaining between 0 and 2),
  add constraint profiles_clone_trials_remaining_check
    check (clone_trials_remaining between 0 and 2);

create table if not exists public.trial_consumption (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('design_preview', 'clone')),
  reference_type text not null check (reference_type in ('task', 'voice')),
  reference_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
  status text not null check (status in ('consumed', 'restored')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists idx_trial_consumption_user_created
  on public.trial_consumption (user_id, created_at desc, id desc);

create index if not exists idx_trial_consumption_operation_reference
  on public.trial_consumption (operation, reference_id)
  where reference_id is not null;

alter table public.trial_consumption enable row level security;

drop policy if exists trial_consumption_service_role_all on public.trial_consumption;
create policy trial_consumption_service_role_all on public.trial_consumption
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.trial_consumption from public;
revoke all on public.trial_consumption from anon;
revoke all on public.trial_consumption from authenticated;
grant select, insert, update, delete on public.trial_consumption to service_role;

revoke all on sequence public.trial_consumption_id_seq from public;
revoke all on sequence public.trial_consumption_id_seq from anon;
revoke all on sequence public.trial_consumption_id_seq from authenticated;
grant usage, select on sequence public.trial_consumption_id_seq to service_role;

alter table public.credit_ledger
  drop constraint if exists credit_ledger_operation_check,
  drop constraint if exists credit_ledger_reference_type_check;

alter table public.credit_ledger
  add constraint credit_ledger_operation_check
    check (operation in (
      'generate',
      'design_preview',
      'clone',
      'monthly_allocation',
      'manual_adjustment',
      'paid_purchase',
      'paid_reversal'
    )),
  add constraint credit_ledger_reference_type_check
    check (reference_type in ('task', 'generation', 'voice', 'profile', 'system', 'billing'));

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

  if p_operation not in (
    'generate',
    'design_preview',
    'clone',
    'monthly_allocation',
    'manual_adjustment',
    'paid_purchase',
    'paid_reversal'
  ) then
    raise exception 'invalid p_operation: %', p_operation using errcode = '22023';
  end if;

  if p_reference_type not in ('task', 'generation', 'voice', 'profile', 'system', 'billing') then
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

create or replace function public.trial_or_debit(
  p_user_id uuid,
  p_operation text,
  p_debit_amount integer,
  p_reference_type text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  used_trial boolean,
  duplicate boolean,
  insufficient boolean,
  balance_remaining integer,
  ledger_id bigint,
  trial_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_existing_trial public.trial_consumption%rowtype;
  v_key text;
  v_metadata jsonb;
  v_debit_applied boolean;
  v_debit_duplicate boolean;
  v_debit_insufficient boolean;
  v_debit_balance integer;
  v_debit_ledger_id bigint;
  v_debit_signed integer;
  v_debit_event_kind text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if p_operation not in ('design_preview', 'clone') then
    raise exception 'invalid p_operation: %', p_operation using errcode = '22023';
  end if;

  if p_reference_type not in ('task', 'voice') then
    raise exception 'invalid p_reference_type: %', p_reference_type using errcode = '22023';
  end if;

  if p_operation = 'design_preview' and p_debit_amount <> 5000 then
    raise exception 'invalid p_debit_amount for design_preview: %', p_debit_amount using errcode = '22023';
  end if;

  if p_operation = 'clone' and p_debit_amount <> 1000 then
    raise exception 'invalid p_debit_amount for clone: %', p_debit_amount using errcode = '22023';
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
  into v_existing_trial
  from public.trial_consumption
  where user_id = p_user_id
    and idempotency_key = v_key
  limit 1;

  if found then
    used_trial := true;
    duplicate := true;
    insufficient := false;
    balance_remaining := v_profile.credits_remaining;
    ledger_id := null;
    trial_id := v_existing_trial.id;
    return next;
    return;
  end if;

  if p_operation = 'design_preview' and v_profile.design_trials_remaining > 0 then
    update public.profiles
    set design_trials_remaining = design_trials_remaining - 1
    where id = p_user_id;

    insert into public.trial_consumption (
      user_id,
      operation,
      reference_type,
      reference_id,
      idempotency_key,
      status,
      metadata
    ) values (
      p_user_id,
      p_operation,
      p_reference_type,
      p_reference_id,
      v_key,
      'consumed',
      v_metadata
    )
    returning id into trial_id;

    used_trial := true;
    duplicate := false;
    insufficient := false;
    balance_remaining := v_profile.credits_remaining;
    ledger_id := null;
    return next;
    return;
  end if;

  if p_operation = 'clone' and v_profile.clone_trials_remaining > 0 then
    update public.profiles
    set clone_trials_remaining = clone_trials_remaining - 1
    where id = p_user_id;

    insert into public.trial_consumption (
      user_id,
      operation,
      reference_type,
      reference_id,
      idempotency_key,
      status,
      metadata
    ) values (
      p_user_id,
      p_operation,
      p_reference_type,
      p_reference_id,
      v_key,
      'consumed',
      v_metadata
    )
    returning id into trial_id;

    used_trial := true;
    duplicate := false;
    insufficient := false;
    balance_remaining := v_profile.credits_remaining;
    ledger_id := null;
    return next;
    return;
  end if;

  select
    debit_result.applied,
    debit_result.duplicate,
    debit_result.insufficient,
    debit_result.balance_remaining,
    debit_result.ledger_id,
    debit_result.signed_amount,
    debit_result.event_kind
  into
    v_debit_applied,
    v_debit_duplicate,
    v_debit_insufficient,
    v_debit_balance,
    v_debit_ledger_id,
    v_debit_signed,
    v_debit_event_kind
  from public.credit_apply_event(
    p_user_id,
    'debit',
    p_operation,
    p_debit_amount,
    p_reference_type,
    p_reference_id,
    v_key,
    v_metadata
  ) as debit_result;

  used_trial := false;
  duplicate := coalesce(v_debit_duplicate, false);
  insufficient := coalesce(v_debit_insufficient, false);
  balance_remaining := coalesce(v_debit_balance, v_profile.credits_remaining);
  ledger_id := v_debit_ledger_id;
  trial_id := null;
  return next;
end;
$$;

create or replace function public.trial_restore(
  p_user_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  restored boolean,
  already_restored boolean,
  trial_id bigint,
  trials_remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trial public.trial_consumption%rowtype;
  v_profile public.profiles%rowtype;
  v_key text;
  v_metadata jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22023';
  end if;

  if p_operation not in ('design_preview', 'clone') then
    raise exception 'invalid p_operation: %', p_operation using errcode = '22023';
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

  select *
  into v_trial
  from public.trial_consumption
  where user_id = p_user_id
    and operation = p_operation
    and idempotency_key = v_key
  for update;

  if not found then
    restored := false;
    already_restored := false;
    trial_id := null;
    trials_remaining := null;
    return next;
    return;
  end if;

  trial_id := v_trial.id;

  if v_trial.status = 'restored' then
    restored := false;
    already_restored := true;
    trials_remaining := null;
    return next;
    return;
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if p_operation = 'design_preview' then
    update public.profiles
    set design_trials_remaining = least(2, design_trials_remaining + 1)
    where id = p_user_id
    returning design_trials_remaining into trials_remaining;
  else
    update public.profiles
    set clone_trials_remaining = least(2, clone_trials_remaining + 1)
    where id = p_user_id
    returning clone_trials_remaining into trials_remaining;
  end if;

  update public.trial_consumption
  set status = 'restored',
      restored_at = now(),
      metadata = trial_consumption.metadata || jsonb_build_object('restore', v_metadata)
  where id = v_trial.id
    and status = 'consumed';

  restored := true;
  already_restored := false;
  return next;
end;
$$;

revoke all on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from public;
revoke execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from anon;
revoke execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) from authenticated;
grant execute on function public.trial_or_debit(uuid, text, integer, text, uuid, text, jsonb) to service_role;

revoke all on function public.trial_restore(uuid, text, text, jsonb) from public;
revoke execute on function public.trial_restore(uuid, text, text, jsonb) from anon;
revoke execute on function public.trial_restore(uuid, text, text, jsonb) from authenticated;
grant execute on function public.trial_restore(uuid, text, text, jsonb) to service_role;

create table if not exists public.billing_events (
  id bigserial primary key,
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('received', 'processed', 'ignored', 'failed')),
  credits_granted integer,
  ledger_id bigint references public.credit_ledger(id) on delete set null,
  error_detail text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_billing_events_user_created
  on public.billing_events (user_id, created_at desc);

alter table public.billing_events enable row level security;

drop policy if exists billing_events_service_role_all on public.billing_events;
create policy billing_events_service_role_all on public.billing_events
  as permissive
  for all
  to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.billing_events from public;
revoke all on public.billing_events from anon;
revoke all on public.billing_events from authenticated;
grant select, insert, update, delete on public.billing_events to service_role;

revoke all on sequence public.billing_events_id_seq from public;
revoke all on sequence public.billing_events_id_seq from anon;
revoke all on sequence public.billing_events_id_seq from authenticated;
grant usage, select on sequence public.billing_events_id_seq to service_role;

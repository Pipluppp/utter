-- ==========================================================================
-- 03_functions.sql — All public-schema function definitions (7 total)
--
-- Uses CREATE OR REPLACE FUNCTION for declarative-diff compatibility.
-- Function bodies may contain DML (INSERT, UPDATE) as part of the
-- function DDL — this is expected and permitted.
--
-- Excluded: increment_task_modal_poll_count (dropped in schema_cleanup_modal_vanity)
-- ==========================================================================

-- ------------------------------------------------------------
-- 1. handle_updated_at() — trigger helper: auto-set updated_at
-- ------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 2. handle_new_user() — trigger helper: auto-create profile
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- ------------------------------------------------------------
-- 3. credit_apply_event() — atomic credit debit/refund/grant
--    (latest version from credits_trials_and_prepaid_billing)
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 4. credit_usage_window_totals() — read-only usage summary
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 5. trial_or_debit() — try free trial first, then debit credits
--    (latest version from pricing_rebalance_credit_debits)
-- ------------------------------------------------------------

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

  if p_operation = 'design_preview' and p_debit_amount <> 2400 then
    raise exception 'invalid p_debit_amount for design_preview: %', p_debit_amount using errcode = '22023';
  end if;

  if p_operation = 'clone' and p_debit_amount <> 200 then
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

-- ------------------------------------------------------------
-- 6. trial_restore() — restore a consumed trial
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 7. rate_limit_check_and_increment() — durable API rate limiter
-- ------------------------------------------------------------

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

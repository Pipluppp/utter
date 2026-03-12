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

-- Phase 08b: Schema validation — tables, columns, types, constraints
BEGIN;
SELECT plan(78);

-- ============================================================
-- PROFILES
-- ============================================================
SELECT has_table('public', 'profiles', 'profiles table exists');
SELECT has_column('public', 'profiles', 'id', 'profiles.id exists');
SELECT col_type_is('public', 'profiles', 'id', 'uuid', 'profiles.id is uuid');
SELECT col_is_pk('public', 'profiles', 'id', 'profiles PK is id');
SELECT has_column('public', 'profiles', 'handle', 'profiles.handle exists');
SELECT has_column('public', 'profiles', 'display_name', 'profiles.display_name exists');
SELECT has_column('public', 'profiles', 'avatar_url', 'profiles.avatar_url exists');
SELECT has_column('public', 'profiles', 'subscription_tier', 'profiles.subscription_tier exists');
SELECT col_not_null('public', 'profiles', 'subscription_tier', 'subscription_tier is NOT NULL');
SELECT col_default_is('public', 'profiles', 'subscription_tier', 'free', 'subscription_tier defaults to free');
SELECT has_column('public', 'profiles', 'credits_remaining', 'profiles.credits_remaining exists');
SELECT col_not_null('public', 'profiles', 'credits_remaining', 'credits_remaining is NOT NULL');
SELECT col_default_is('public', 'profiles', 'credits_remaining', '100', 'credits_remaining defaults to 100');
SELECT has_column('public', 'profiles', 'created_at', 'profiles.created_at exists');
SELECT has_column('public', 'profiles', 'updated_at', 'profiles.updated_at exists');

-- ============================================================
-- VOICES
-- ============================================================
SELECT has_table('public', 'voices', 'voices table exists');
SELECT has_column('public', 'voices', 'id', 'voices.id exists');
SELECT col_type_is('public', 'voices', 'id', 'uuid', 'voices.id is uuid');
SELECT col_is_pk('public', 'voices', 'id', 'voices PK is id');
SELECT has_column('public', 'voices', 'user_id', 'voices.user_id exists');
SELECT col_not_null('public', 'voices', 'user_id', 'voices.user_id is NOT NULL');
SELECT has_column('public', 'voices', 'name', 'voices.name exists');
SELECT col_not_null('public', 'voices', 'name', 'voices.name is NOT NULL');
SELECT has_column('public', 'voices', 'reference_object_key', 'voices.reference_object_key exists');
SELECT has_column('public', 'voices', 'reference_transcript', 'voices.reference_transcript exists');
SELECT has_column('public', 'voices', 'language', 'voices.language exists');
SELECT col_default_is('public', 'voices', 'language', 'Auto', 'voices.language defaults to Auto');
SELECT has_column('public', 'voices', 'source', 'voices.source exists');
SELECT col_not_null('public', 'voices', 'source', 'voices.source is NOT NULL');
SELECT has_column('public', 'voices', 'description', 'voices.description exists');

-- ============================================================
-- GENERATIONS
-- ============================================================
SELECT has_table('public', 'generations', 'generations table exists');
SELECT has_column('public', 'generations', 'id', 'generations.id exists');
SELECT col_type_is('public', 'generations', 'id', 'uuid', 'generations.id is uuid');
SELECT has_column('public', 'generations', 'user_id', 'generations.user_id exists');
SELECT col_not_null('public', 'generations', 'user_id', 'generations.user_id is NOT NULL');
SELECT has_column('public', 'generations', 'voice_id', 'generations.voice_id exists');
SELECT has_column('public', 'generations', 'text', 'generations.text exists');
SELECT col_not_null('public', 'generations', 'text', 'generations.text is NOT NULL');
SELECT has_column('public', 'generations', 'status', 'generations.status exists');
SELECT col_default_is('public', 'generations', 'status', 'pending', 'generations.status defaults to pending');

-- ============================================================
-- TASKS
-- ============================================================
SELECT has_table('public', 'tasks', 'tasks table exists');
SELECT has_column('public', 'tasks', 'id', 'tasks.id exists');
SELECT col_type_is('public', 'tasks', 'id', 'uuid', 'tasks.id is uuid');
SELECT has_column('public', 'tasks', 'user_id', 'tasks.user_id exists');
SELECT col_not_null('public', 'tasks', 'user_id', 'tasks.user_id is NOT NULL');
SELECT has_column('public', 'tasks', 'type', 'tasks.type exists');
SELECT col_not_null('public', 'tasks', 'type', 'tasks.type is NOT NULL');
SELECT has_column('public', 'tasks', 'status', 'tasks.status exists');
SELECT col_default_is('public', 'tasks', 'status', 'pending', 'tasks.status defaults to pending');
SELECT has_column('public', 'tasks', 'modal_poll_count', 'tasks.modal_poll_count exists');
SELECT col_default_is('public', 'tasks', 'modal_poll_count', '0', 'modal_poll_count defaults to 0');

-- ============================================================
-- CREDIT LEDGER
-- ============================================================
SELECT has_table('public', 'credit_ledger', 'credit_ledger table exists');
SELECT has_column('public', 'credit_ledger', 'id', 'credit_ledger.id exists');
SELECT col_type_is('public', 'credit_ledger', 'id', 'bigint', 'credit_ledger.id is bigint');
SELECT col_is_pk('public', 'credit_ledger', 'id', 'credit_ledger PK is id');
SELECT has_column('public', 'credit_ledger', 'user_id', 'credit_ledger.user_id exists');
SELECT col_not_null('public', 'credit_ledger', 'user_id', 'credit_ledger.user_id is NOT NULL');
SELECT has_column('public', 'credit_ledger', 'event_kind', 'credit_ledger.event_kind exists');
SELECT col_not_null('public', 'credit_ledger', 'event_kind', 'credit_ledger.event_kind is NOT NULL');
SELECT has_column('public', 'credit_ledger', 'operation', 'credit_ledger.operation exists');
SELECT col_not_null('public', 'credit_ledger', 'operation', 'credit_ledger.operation is NOT NULL');
SELECT has_column('public', 'credit_ledger', 'amount', 'credit_ledger.amount exists');
SELECT has_column('public', 'credit_ledger', 'signed_amount', 'credit_ledger.signed_amount exists');
SELECT has_column('public', 'credit_ledger', 'balance_after', 'credit_ledger.balance_after exists');
SELECT has_column('public', 'credit_ledger', 'reference_type', 'credit_ledger.reference_type exists');
SELECT has_column('public', 'credit_ledger', 'idempotency_key', 'credit_ledger.idempotency_key exists');
SELECT has_column('public', 'credit_ledger', 'metadata', 'credit_ledger.metadata exists');
SELECT col_default_is('public', 'credit_ledger', 'metadata', '{}', 'credit_ledger.metadata defaults to {}');
SELECT has_column('public', 'credit_ledger', 'created_at', 'credit_ledger.created_at exists');

-- ============================================================
-- RATE LIMIT COUNTERS
-- ============================================================
SELECT has_table('public', 'rate_limit_counters', 'rate_limit_counters table exists');
SELECT has_column('public', 'rate_limit_counters', 'actor_type', 'rate_limit_counters.actor_type exists');
SELECT col_not_null('public', 'rate_limit_counters', 'actor_type', 'rate_limit_counters.actor_type is NOT NULL');
SELECT has_column('public', 'rate_limit_counters', 'actor_key', 'rate_limit_counters.actor_key exists');
SELECT col_not_null('public', 'rate_limit_counters', 'actor_key', 'rate_limit_counters.actor_key is NOT NULL');
SELECT has_column('public', 'rate_limit_counters', 'tier', 'rate_limit_counters.tier exists');
SELECT has_column('public', 'rate_limit_counters', 'window_start', 'rate_limit_counters.window_start exists');
SELECT has_column('public', 'rate_limit_counters', 'request_count', 'rate_limit_counters.request_count exists');
SELECT col_default_is('public', 'rate_limit_counters', 'request_count', '0', 'rate_limit_counters.request_count defaults to 0');

SELECT * FROM finish();
ROLLBACK;

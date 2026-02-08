-- Phase 08b: Extension + schema sanity checks
BEGIN;
SELECT plan(3);

SELECT has_extension('pgcrypto', 'pgcrypto extension is installed');
SELECT has_extension('pgtap', 'pgtap extension is available');
SELECT has_schema('public', 'public schema exists');

SELECT * FROM finish();
ROLLBACK;

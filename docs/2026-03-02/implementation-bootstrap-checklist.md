# Cloudflare Migration Bootstrap Checklist

Date: 2026-03-01

Use this checklist before starting implementation in a fresh context/worktree.

## 1) Worktrees

Expected local layout:

- `C:\Users\Duncan\Desktop\utter` -> docs/planning branch (`codex/feature/cloudflare-migration`)
- `C:\Users\Duncan\Desktop\utter-cloudflare-impl` -> implementation branch (`codex/cloudflare-migration-impl`)
- `C:\Users\Duncan\Desktop\utter-main` -> clean baseline (`main`)

Verify:

```bat
git -C C:\Users\Duncan\Desktop\utter worktree list
```

## 2) Auth + CLI bootstrap

Run:

```bat
C:\Users\Duncan\Desktop\utter\scripts\cloudflare-migration\bootstrap-auth.cmd
```

This will:

1. Check Node/npm
2. Install `wrangler`
3. Login/verify Cloudflare auth
4. Login/verify Supabase auth
5. Check Supabase link status
6. Prompt Cloudflare resource visibility checks

## 3) Supabase project

If project is not linked yet:

```bat
npx supabase link --project-ref jgmivviwockcwjkvpqra
```

## 4) First implementation commands (in `utter-cloudflare-impl`)

```bat
cd C:\Users\Duncan\Desktop\utter-cloudflare-impl
npm install
npm --prefix frontend install
supabase start
```

## 5) Guardrails

1. Keep `/api/*` contract unchanged.
2. Do not cut production to Workers while `waitUntil` long-running Qwen paths remain.
3. Ship Queue Q1 in same rollout train as API cutover on Cloudflare Free.
4. Keep Supabase DB/Auth/RLS and credits/billing RPC semantics unchanged.


# Plan: Base Docs Realignment to Current Stack

## Goal

Update base documentation so the Cloudflare hybrid stack is the default/current architecture, and old-stack references are historical context only.

## Problem statement

Core docs still present prior stack assumptions (for example Vercel frontend + Supabase Edge Function runtime as primary) that can confuse implementation and operations.

## Realignment rules

1. Base docs describe the current stack first.
2. Prior stack references move under "historical" sections.
3. Date-stamped migration docs remain immutable evidence where practical.
4. Avoid contradictory setup instructions across files.

## Target docs for update

1. `../README.md`
2. `../architecture.md`
3. `../backend.md`
4. `../deployment-architecture.md`
5. `../vercel-frontend.md` (reposition as legacy/comparison if still retained)
6. `../../AGENTS.md` (repo working guide alignment)

## Tasks

1. Inventory all stack statements and classify as current vs outdated.
2. Patch docs to make Cloudflare hybrid the default narrative.
3. Add "historical stack" notes only where needed.
4. Validate links and quickstart commands after edits.
5. Add a docs changelog entry summarizing the realignment.

## Deliverables

1. `docs-realignment-change-list.md`
2. `docs-realignment-pr-checklist.md`

## Exit criteria

1. No core doc claims the previous stack as default/current
2. One canonical quickstart exists for the current stack
3. Historical notes are clearly labeled and non-blocking

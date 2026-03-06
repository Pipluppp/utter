# Plan 01: Security Maturity First (Before Active Bug Hunt)

## Goal

Create the minimum operating model needed to handle findings quickly and consistently before deep penetration testing.

## Why this comes first

Without triage, ownership, and release processes, discovered vulnerabilities create noise and bottlenecks rather than durable risk reduction.

## Work items

1. Define security ownership by surface:
- Frontend worker
- API worker + queues
- Supabase auth/db/RLS
- Cloudflare infra/secrets
- Billing/credits abuse controls

2. Define severity and response model:
- Severity rubric (Critical/High/Medium/Low)
- Fix SLAs per severity
- Rollback and hotfix authority
- Disclosure/communication workflow

3. Define secure engineering baselines:
- Secure code review checklist
- Threat modeling checklist
- Security testing gates for CI/CD
- Required evidence for deployment approval

4. Define security logging and evidence retention:
- What events must be logged
- How long logs are retained
- How incidents are reconstructed

5. Define security champion model:
- One champion per major area (frontend, worker API, db)
- Triage and escalation responsibilities

## Deliverables

1. Security ownership matrix
2. Severity + SLA rubric document
3. Secure review/testing checklist
4. Incident response mini-runbook

## Exit criteria

1. Every finding path has an owner and expected SLA.
2. Teams agree on triage and hotfix workflow.
3. Testing/release gates are documented and enforceable.

# Security Finding Evidence Template

Use one copy of this template per finding.

## Metadata

- Finding ID:
- Date/time (UTC):
- Reporter:
- Environment: `local` | `staging` | `production`
- Surface: `frontend` | `api-worker` | `queue` | `supabase` | `cloudflare-infra` | `billing/credits`
- Related plan item:

## Summary

- Title:
- Short description:
- OWASP category (if applicable):
- Suspected severity:

## Preconditions

- Account type/role used:
- Required configuration:
- Data/setup state:

## Reproduction steps

1.
2.
3.

### Commands/requests executed

```bash
# Paste exact commands/curl/httpie/wrangler/sql used
```

## Expected vs actual

- Expected behavior:
- Actual behavior:

## Evidence

- Response payloads/log snippets:
- DB evidence (query results):
- Worker/queue logs:
- Screenshots/video (if any):

## Impact analysis

- Confidentiality impact:
- Integrity impact:
- Availability impact:
- Abuse/fraud impact:
- Blast radius (users/tenants/systems):

## Root cause hypothesis

- Suspected cause:
- Affected files/components:

## Remediation proposal

- Immediate mitigation:
- Permanent fix:
- Regression test to add:

## Verification

- Fix commit/PR:
- Retest steps:
- Retest result:
- Final severity:
- Sign-off:

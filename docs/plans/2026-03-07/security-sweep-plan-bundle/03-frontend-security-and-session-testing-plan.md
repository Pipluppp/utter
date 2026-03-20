# Plan 03: Frontend Security and Session Handling Tests

## Goal

Validate that the browser-facing layer protects auth/session integrity and does not expose security-sensitive data or unsafe runtime behavior.

## Scope

1. SPA auth/session handling with hosted Supabase
2. Frontend Worker response headers and proxy behavior
3. Client-side data exposure and dependency risk

## Test tasks

1. Session/auth handling:
- Verify login/signup/reset flows only target hosted Supabase URL
- Verify no localhost/dev auth URLs in production assets
- Verify token lifecycle handling and logout semantics

2. Browser security controls:
- Verify CSP, frame-ancestors/X-Frame-Options, Referrer-Policy, nosniff
- Verify CORS behavior at frontend boundary
- Verify caching directives for sensitive responses

3. Client exposure checks:
- Check for secret leakage in built JS/CSS/source maps
- Check public env vars are expected and non-sensitive
- Check no service-role or private endpoint leakage

4. Input/output handling:
- UI-side handling of untrusted provider error strings
- Defenses against reflected/stored XSS in user-visible fields

5. Supply chain and dependency posture:
- SCA audit of frontend dependencies
- Pin/range review for high-risk packages

## Deliverables

1. Frontend security test report
2. Required header baseline for frontend worker
3. Dependency risk list with remediation tasks

## Exit criteria

1. No sensitive values or localhost endpoints exposed in deployed assets.
2. Browser security headers meet agreed baseline.
3. High-risk dependency issues have owners and fix plans.

# Cloudflare Security Hardening - Execution Prompt

Read `cloudflare-security-plan.md` (in this directory) and walk me through implementing the Cloudflare WAF security configuration for `uttervoice.com`. This task is entirely dashboard-based with no code changes.

This task is almost entirely manual. Your role is to guide me step by step through the Cloudflare dashboard, one action at a time. After each step, wait for my confirmation before moving to the next.

## Step 0 - Preflight

Before changing any toggles, have me confirm two things:

1. These rules protect the `uttervoice.com` zone only, not direct `*.workers.dev` hostnames.
2. No trusted webhook or other machine-to-machine client currently depends on `https://uttervoice.com/api/*`.

If I tell you a trusted machine client uses the branded `/api/*` surface, tell me to leave `Bot Fight Mode` off for now and continue with the rest of the plan.

## Step 1 - Dashboard toggles

Walk me through each toggle in `Security -> Settings`:

1. `Bot Fight Mode` -> on only if Step 0 confirmed the branded `/api/*` surface is browser-only
2. `Block AI Bots` -> on
3. `Browser Integrity Check` -> verify on

If the current UI shows an `Activate basic features` modal instead of separate Browser Integrity Check / Onion Routing toggles, tell me to keep `Browser Integrity Check` enabled and uncheck `Onion Routing` before activating.

Then `Network -> Onion Routing -> off`, or the equivalent current-UI path if it is bundled in basic features.

Wait for my confirmation after each toggle group.

## Step 2 - WAF Custom Rules

Guide me through creating each rule one at a time. For each rule:

1. Tell me the rule name, action, and placement order.
2. Give me the expression to paste into `Edit expression`.
3. For Rule 1 (`Skip`), list every WAF component checkbox I need to check.
4. Explicitly note that Bot Fight Mode cannot be skipped and that the dashboard may or may not expose `All remaining custom rules`.
5. Wait for me to confirm the rule is deployed before moving to the next.

Rule order:

1. `Allow Good Bots` (`Skip`, place first)
2. `Aggressive Crawlers` (`Managed Challenge`, after Rule 1)
3. `Challenge Large Providers` (`Managed Challenge`, after Rule 2)
4. `Block Scanner Paths, Tor, AI Crawlers` (`Block`, after Rule 3)

## Step 3 - WAF Rate Limiting Rule

Walk me through creating the single rate limiting rule:

- Expression: `(http.request.uri.path eq "/api") or (http.request.uri.path contains "/api/")`
- 50 requests per 10 seconds per IP
- `Block` action
- 10 second mitigation timeout

Wait for my confirmation.

## Step 4 - Verification

After I confirm all rules are deployed, guide me through verifying in `Analytics -> Events` that the rules are active. Note that older docs or older dashboard flows may still refer to `Security -> Events`.

Then have me:

1. test normal site access
2. test normal browser API usage
3. confirm nothing is broken for real users

If Bot Fight Mode was enabled, also have me confirm no trusted non-browser client is using `https://uttervoice.com/api/*`.

End by reminding me that direct `*.workers.dev` hostnames are still outside this zone-level WAF setup.

At the end, update `docs/2026-03-18/README.md` execution status to mark this task as complete and add a short implementation audit in this directory summarizing what was changed and verified.

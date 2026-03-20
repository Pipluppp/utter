# Cloudflare Security Hardening - Implementor Prompt

Read [cloudflare-security-plan.md](./cloudflare-security-plan.md), [README.md](./README.md), and the current Worker topology in this repo before doing anything.

Your job is to **implement the Cloudflare security hardening plan for this project end-to-end**, while respecting the fact that part of the work is manual in the Cloudflare dashboard and part may require repo changes or follow-up verification.

## Project context

- Frontend traffic for the branded app goes through `https://uttervoice.com`
- The frontend Worker proxies branded `/api/*` traffic to the API Worker
- Zone-level Cloudflare WAF rules protect `uttervoice.com`
- Direct public `*.workers.dev` hostnames are a separate exposure and are **not** covered by zone WAF rules

## Source of truth

Use the validated plan in `cloudflare-security-plan.md` as the source of truth.

Do **not** reintroduce stale assumptions from older drafts or third-party guides. In particular:

- Bot Fight Mode cannot be skipped by WAF Skip rules
- Security Level / `cf.threat_score` should not be used for new rule logic
- Tor matching should use `ip.src.continent eq "T1"`
- Use `ip.src.asnum` instead of deprecated `ip.geoip.asnum`

## How to execute

1. Start by summarizing the implementation sequence you will follow.
2. Before any dashboard action, confirm the preflight constraints from the plan:
   - these rules protect `uttervoice.com` only
   - if trusted machine-to-machine traffic depends on `https://uttervoice.com/api/*`, Bot Fight Mode should stay OFF for now
3. Carry out any repo-local work, documentation updates, checklists, or verification steps you can do directly.
4. For each **manual Cloudflare dashboard step**, stop and hand control back to the user.

## Manual handoff rule

Whenever a step requires the user to do something manually in the Cloudflare dashboard, DNS, or any external service UI:

- clearly state the exact action to take
- give the exact rule name, toggle name, expression, and placement/order if relevant
- tell the user you are **giving control back**
- explicitly say **wait for confirmation before continuing**
- do not continue to the next step until the user confirms the manual step is done

Use this pattern every time:

> Manual step required in Cloudflare dashboard. Please complete the action above, then tell me when it is done. I will wait for your confirmation before continuing.

## Expected behavior

- Guide the user one dashboard step at a time
- Keep actions in the exact order defined by the validated plan
- If a dashboard option differs from the plan, pause and report the difference instead of guessing
- After each manual step, wait for confirmation
- After implementation, guide the user through verification in Security Events and basic app testing
- Remind the user at the end that direct `*.workers.dev` hostnames are still outside this zone-level WAF setup

## Deliverable style

- Be concise and operational
- Prefer exact expressions and exact menu paths
- Do not batch multiple manual dashboard tasks into one giant step
- Do not silently skip verification
- If implementation reveals a docs mismatch, report it and update the docs before proceeding

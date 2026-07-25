---
name: pact-web-e2e-verification
description: How to launch pact-web and drive it end-to-end for verification - dev:mock vs dev vs dev:real, the port it serves on, mock-mode auto-login and persona switching, the E2E verification checklist, and the two Playwright setups available for automation. Use before opening any pact-web PR, and whenever asked to "verify this works", "check the running app", or "test this end-to-end".
---

# pact-web-e2e-verification

Passing `pnpm run test` and `pnpm run build` is not verification.
Before any pact-web PR is opened, the change must be exercised in a running app, as a real user would hit it.
This skill is the launch + drive + report procedure for that.

## Launch modes

Three dev scripts, read from `package.json`:

| Script | Backend | Requires |
|---|---|---|
| `pnpm run dev:mock` | MSW intercepts every HTTP call, no real services | Nothing else running - fully standalone |
| `pnpm run dev` | Real `pact-gateway` and, through it, every other PACT service | `vercel env pull` credentials, then the org's unified dev stack (`.github-private/doc/DEVSTACK.md`, `make dev` from `.github-private/dev-stack/`) |
| `pnpm run dev:real` | Same real-backend wiring as `dev`, but reads `env/local-real.env` directly instead of pulling from Vercel | The dev stack, same as `dev` |

**Default to `dev:mock` for verification.** It is the fastest loop and covers the overwhelming majority of UI/flow changes.
Reach for `dev` or `dev:real` only when the change touches real gRPC wiring, real auth (OAuth, MFA, session cookies against `pact-auth`), or anything MSW cannot faithfully fake.

**Port: `3000`.** Verified live - `next dev --turbopack` under `dev:mock` printed `Local: http://localhost:3000` and `Ready in 12.9s`.
This matches the port row for pact-web in `.github-private/doc/DEVPORTS.md`.
Override with `PLAYWRIGHT_PORT` or `LAN_PORT` only if `3000` is already taken.

Shut the dev server down when verification is done - it is a foreground process; `Ctrl+C` in the terminal that launched it, or kill the process bound to port `3000` if it was backgrounded.

## Mock-mode auth behavior (verified live)

For the full mechanism (the `isMock()` helper, the MSW bootstrap, the `validateSessionFromCookies()` short-circuit, the `MockUserType` cookie), read the `pact-dev-mock` skill first - it documents the implementation from source.
This section records what was actually observed driving the running app, as a verification reference:

- Navigating to `http://localhost:3000/` under `dev:mock` redirects to `/dashboard?intro=1` with a `200` - no `/login` hit, no session cookie needed. `curl -sD- http://localhost:3000/` showed `location: /dashboard?intro=1`.
- The `?intro=1` root redirect plays a full-screen "Welcome to PACT" splash animation (`role="dialog" aria-label="Welcome to PACT"`) that intercepts pointer events for a few seconds before settling. **For scripted verification, navigate straight to a route (e.g. `http://localhost:3000/dashboard`) to skip it** - a direct route hit does not show the splash.
- The default persona is `admin`. The sidebar renders a "Mock user: admin" trigger with a visible seeded identity ("Ada Lovelace") next to it; no `mock-user-type` cookie exists yet at this point, confirming the documented server-side default.
- Clicking the "Mock user: admin" trigger opens the persona switcher; clicking "Auditor" set a `mock-user-type=auditor` cookie immediately and re-rendered the trigger to "Mock user: auditor" with no page reload.
- With MSW active, the browser console groups every intercepted call as `[MSW] <time> <method> <path> (<status>)`, e.g. `GET /v1/account/profile (200 OK)`, `GET /api/pact/gateway/v1/benchmark/runs (200 OK)`. That console group is the fastest way to confirm a component is actually calling the orval/SWR hook you expect, without opening the Network tab.

## E2E verification checklist

Run this before opening any pact-web PR, for any route or flow the diff touches:

1. **Launch** `dev:mock` (or `dev`/`dev:real` if the change requires a real backend - see above).
2. **Navigate to the changed route directly** (skip `/` to avoid the splash screen) and confirm it loads with no error boundary.
3. **Exercise the flow as a user would** - click through the actual interaction the change enables, not just a static render check.
4. **Browser console is clean.** No `[error]` or `[pageerror]` entries beyond the pre-existing benign noise (see "Known benign console noise" below). A new warning or error introduced by the diff is a blocker.
5. **Network / MSW console groups show the expected calls.** The orval/SWR hooks the change touches should appear as `[MSW] ... (200 OK)` (or the expected error status if the flow tests an error state) - not silently missing, not falling through to an unmocked-request warning.
6. **If the change is persona-sensitive**, switch personas via the sidebar switcher and re-check the flow under each relevant persona.
7. **Be picky about the UI.** If anything looks off - layout, spacing, a stale label, a broken image - even outside the change's own scope, fix it or flag it explicitly in the report. Do not let it pass silently.

### Known benign console noise (as of this writing)

Observed on a stock `dev:mock` dashboard load, unrelated to any particular change - do not treat these as your diff's fault, but do re-check they are still the only noise:

- `Error with Permissions-Policy header: Unrecognized feature: '...'` - browser-level warnings about experimental Permissions-Policy directives, not app bugs.
- `MSW Warning: intercepted a request without a matching request handler` for `https://i.pravatar.cc/150?u=...` - the seeded mock avatar URL points at a real third-party image host that MSW does not (and should not) mock.
- `The width(-1) and height(-1) of chart should be greater than 0` from `recharts` - fires on the dashboard's chart widgets during the initial `dev:mock` render, pre-existing and unrelated to any diff.

If new console output appears beyond these, it belongs to the diff being verified - investigate it, don't wave it through.

## Browser-automation approach

Two Playwright configs exist in the repo, plus manual driving:

- **`playwright.config.ts`** (`pnpm run pw:run` / `pnpm run pw:open`) - the default. `testDir: ./src`, matches `src/app/{feature}/test/{feature}.spec.ts`. Boots its own `dev:mock` server via `webServer`. This is where committed, repeatable E2E specs for a feature live - see the `writing-e2e-tests` skill for how to write them.
- **`playwright.e2e.config.ts`** (`pnpm run pw:e2e` / `pnpm run pw:e2e:ui`) - full-stack suite under `e2e/`. Requires `pact-auth` and Postgres actually running (`cd ../pact-auth && make compose-up && make dev`); starts pact-web in `dev:real`. Use only when verifying something MSW cannot fake, e.g. real MFA/TOTP or password-reset flows - see `e2e/mfa-totp.spec.ts` and `e2e/password-reset-mfa.spec.ts` for the existing coverage.
- **Manual/ad hoc driving** - for one-off PR verification that does not warrant a committed spec, drive the running `dev:mock` server directly: a browser-automation tool attached to the live tab, or a throwaway Playwright script run with `node` from inside the repo (so it resolves `node_modules`) that navigates, screenshots, and dumps `page.on('console', ...)` output. Delete the throwaway script before committing - it is a verification aid, not a deliverable.

## The reporting bar

Report what was actually seen, not what should happen.

A verification report names the concrete port, the concrete route hit, the concrete console/network output observed, and (when relevant) a screenshot - never a restatement of what the code is expected to do.
"Should redirect to `/dashboard`" is not a finding; "redirected to `/dashboard?intro=1`, confirmed via `curl -sD-`" is.
If something was not actually driven and observed, say so explicitly rather than inferring it from reading the source.

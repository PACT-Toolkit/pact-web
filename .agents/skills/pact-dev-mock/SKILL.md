---
name: pact-dev-mock
description: How `pnpm run dev` and `pnpm run dev:mock` are separated in pact-web — the `isMock()` env helper, MSW browser + Node bootstrap (instrumentation.ts), auto-login short-circuit in `validateSessionFromCookies()`, persona switching via `MockUserType` cookie, OAuth route handler bypass, server-side `getApiBaseUrl()`, and the handler URL-pattern hygiene test. Use when touching auth flow, server-side fetch wiring, mock-mode plumbing, or anything env-conditional.
---

# pact-dev-mock

How the two dev modes are wired and where to branch on `isMock()`.

## Modes

- **`pnpm run dev`** — talks to a real `pact-gateway` (and through it, every other PACT service). Requires services running locally; auth flow is real.
- **`pnpm run dev:mock`** — sets `NEXT_PUBLIC_API_MOCKING=enabled`. MSW intercepts every HTTP call (browser worker + Node setupServer), the login flow is skipped, and a synthetic user identity is stitched together so the rest of the app behaves as if a real user is signed in.

The whole separation hinges on one boolean: `isMock()`.

## Env helpers

`src/framework/helpers/environment.ts` exports:

| Helper | True when | Use it to |
|---|---|---|
| `isMock()` | `NEXT_PUBLIC_API_MOCKING === 'enabled'` | Branch on dev:mock vs every other mode. |
| `isLocalDevelopment()` | `NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'development'` | Loosen things only for local dev (LAN origins, etc.). |
| `isPreview()` | `NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'preview'` | Vercel preview deployments. |
| `isProduction()` | `NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'production'` | Production. |
| `MOCK_USER_ID` | constant | Stable UUID used by the mock session + mock account profile. Production never sees it. |

**`isMock()` works in every runtime** — Server Components, route handlers, middleware, client components, and Node tests. It just reads a `NEXT_PUBLIC_*` var, no async, no module side effects.

## MSW bootstrap

MSW runs in three places, all wired off the same handler array in `mocks/handlers.ts`:

| Where | File | Activated by |
|---|---|---|
| Browser worker | `mocks/browser.ts` → `mocks/index.ts` `init()` | `<MSWProvider>` mounts on the client and calls `init()` if `NEXT_PUBLIC_API_MOCKING === 'enabled'`. Service worker URL is pinned to `/mockServiceWorker.js`. |
| Next.js Node runtime | `mocks/server.ts` ← `instrumentation.ts` | `instrumentation.ts` calls `register()` once at server startup; it checks `process.env.NEXT_RUNTIME === 'nodejs'` + `NEXT_PUBLIC_API_MOCKING === 'enabled'` and calls `server.listen(...)`. Required so Server Components and route handlers also see mocked responses. |
| Vitest | `mocks/server.ts` ← `vitest.setup.ts` | `beforeAll` calls `server.listen()`, `afterEach` resets, `afterAll` closes. |

**Both browser and Node use the same `handlers` array.** That means handler URL patterns must work in both - see the [Handler patterns](#handler-patterns) rule below.

### Browser worker readiness (PACT-455)

The browser Service Worker only intercepts fetch/XHR once it has registered, activated, and taken control of the page. Any request fired before that point slips past MSW onto the real network - which in dev:mock has no backend behind it. An older `worker.start()` readiness option that was once documented as the guard for this turned out to be a deprecated no-op in the installed msw version (prints a warning, defers nothing) and has been removed from `mocks/index.ts`.

The actual guard is a shared readiness gate, not a per-spec workaround:

- `src/framework/msw/msw_ready.ts` exports `mswReady`, a promise every outgoing request awaits before it's allowed to fire for real. It resolves immediately on the server and outside mock mode; in the browser under `dev:mock` it stays pending until `signalMswReady()` runs.
- `src/framework/msw/msw_fetch_gate.ts` patches the global `window.fetch` to await `mswReady` first. It's installed from module scope in `msw_provider.tsx` (not inside a `useEffect`), so it's armed while the client bundle is first evaluated - before hydration commits and before any component's effects can fire a request. This is what covers the orval-generated REST hooks (`client: 'swr'` in `orval.config.ts` means the generated fetchers call `fetch` directly) plus any other first-party code that calls `fetch` directly.
- `src/framework/http/axios.ts` adds a request interceptor on `httpClient` awaiting the same `mswReady`, since axios's browser adapter uses `XMLHttpRequest` rather than `fetch` and isn't covered by the patch above.
- `mocks/index.ts` calls `signalMswReady()` in a `finally` around `worker.start()`, so a failed bootstrap still releases queued requests - they surface a visible network error instead of hanging the app forever.

If you add a new HTTP transport to the app (a raw `XMLHttpRequest`, `navigator.sendBeacon`, a WebSocket-based request/response pattern, etc.), it needs its own await on `mswReady` - the fetch patch and the axios interceptor only cover those two transports.

`instrumentation.ts` is in the repo root and is allowlisted in `.gitignore` (the repo uses an allowlist-style ignore — adding a new root-level file means adding `!filename` to `.gitignore`).

## Auto-login in mock mode

`src/framework/auth/pact_auth/session.ts` short-circuits `validateSessionFromCookies()` when `isMock()`:

```ts
export const validateSessionFromCookies = async (): Promise<Session | null> => {
  if (isMock()) {
    return { userId: MOCK_USER_ID, expiresAt: MOCK_SESSION_EXPIRES_AT };
  }
  // ...real cookie + gRPC validation
};
```

This means in `dev:mock`:
- `requireSession()` never redirects to `/login`
- Server Components under `app/(app)/layout.tsx` get a synthetic session with `userId === MOCK_USER_ID`
- No `pact_session` cookie required; no pact-auth roundtrip

The root page `app/page.tsx` also branches: `redirect(isMock() ? '/dashboard' : '/login')`.

**When you add another server-side auth check** (e.g. a new `requireRole()` helper), follow the same pattern — early-return a synthetic value in `isMock()` mode rather than mocking the gRPC client.

## OAuth in mock mode

The OAuth route handlers (`app/api/auth/oauth/start/route.ts`, `app/v1/auth/callback/[provider]/route.ts`) short-circuit at the top with `if (isMock()) { ... }`:

- **`/api/auth/oauth/start`**: skip `startLogin()` gRPC, redirect straight to our own callback with synthetic `code` + `state` + state cookie.
- **`/v1/auth/callback/{provider}`**: skip `handleCallback()` gRPC, set a synthetic `pact_session` cookie (cosmetic — `validateSessionFromCookies` ignores its value in mock mode anyway), redirect to `return_to`.

The result: SSO buttons on `/login` are clickable in dev:mock without pact-auth or real OAuth providers being reachable.

## Persona switching (`MockUserType`)

`src/framework/helpers/mock_user_type.ts` defines:

```ts
export type MockUserType = 'admin' | 'auditor' | 'developer';
```

The active persona lives in the `mock-user-type` cookie. Helpers:

- `getMockUserType()` — reads `document.cookie` client-side; returns `'admin'` server-side (server-side reads should plumb through request headers when persona-aware).
- `setMockUserType(t)` — writes the cookie with `path=/`; caller is responsible for triggering a refresh.
- `isMockUserType(types)` — predicate.

The switcher UI lives at `src/components/mock-user-type-switcher.tsx` (mounted by `app-sidebar.tsx` inside `SidebarContent`). It uses `useSyncExternalStore` so the snapshot stays consistent across SSR/client without violating `react-hooks/set-state-in-effect`.

**To make a handler persona-aware**, read the cookie at request time and overlay onto the seeded data — don't re-seed (see `pact-mock-data` skill for the pattern).

## Server-side fetch

If a Server Component or route handler needs to call `fetch('/api/pact/...')`, use `getApiBaseUrl()` from `src/framework/helpers/api_base_url.ts` to get an absolute URL:

```ts
import { getApiBaseUrl } from '@/src/framework/helpers/api_base_url';

const res = await fetch(`${getApiBaseUrl()}/api/pact/account/v1/profile`);
```

The helper returns `http://localhost:${PORT}` — pointing at the dev server itself, so MSW (via `instrumentation.ts`) intercepts in mock mode and the catch-all proxy forwards in real mode. No client/server divergence.

The helper is `'server-only'` — importing from a `'use client'` file fails the build.

**Browser code keeps using relative paths** (`fetch('/api/pact/...')`). They resolve against `location.origin` and the browser SW / proxy handle them.

## Handler patterns (hygiene test)

`src/framework/helpers/msw_handler_patterns.test.ts` asserts every handler's path is a `*/...` glob, not a leading-slash relative path. Leading-slash paths only match in the browser; on the Node side (Vitest, `instrumentation.ts`, Server Components) there's no `location.origin`, so they silently miss and the request leaks to the real backend.

The test runs as part of `pnpm run test` and fails CI listing every offender.

## Where to branch on `isMock()`

Default: branch as **deep** as you can, not at the top level. If only one method on a service stub needs to fake a value, branch inside that method, not at the import.

Bad — replaces the whole client in mock mode, fragile and hard to read in real mode:

```ts
export const getPactAuthClient = () => isMock() ? mockClient : realClient;
```

Good — early-return inside the function that actually wants the synthetic value:

```ts
export const validateSessionFromCookies = async () => {
  if (isMock()) return { userId: MOCK_USER_ID, expiresAt: FAR_FUTURE };
  // ...real path
};
```

The pattern: `isMock()` checks are **local guards inside real functions**, not separate mock implementations.

## What NOT to do

- **Don't add ad-hoc env-var checks.** Use `isMock()` / `isLocalDevelopment()` / `isPreview()` / `isProduction()` — every other branch in the codebase uses those exact helpers, and the lint setup expects them.
- **Don't bypass MSW with a parallel mock server.** Every mock lives behind MSW so the same handler array works in browser, Node, and tests. Adding a separate Express/Node side-server fragments the surface.
- **Don't put `'use client'` on any file that imports `'server-only'` code or otherwise holds session/auth secrets.** `framework/auth/pact_auth/{session,client,cookies,factors,mock,return_to}.ts` and `framework/helpers/api_base_url.ts` are `'server-only'` and must stay that way - Next.js already fails the build if a `'server-only'` import reaches a client bundle, so don't fight that by adding `'use client'` nearby. `'use client'` is fine elsewhere in `framework/` for cross-cutting client infrastructure that isn't feature-specific: providers (`msw/msw_provider.tsx`, `swr/swr_provider.tsx`, `theme/theme_provider.tsx`), framework-level interactive UI (`motion/splash_screen/*`, `theme/theme_toggle.tsx`), and headless hooks (`auth/pact_auth/sign_out.ts`). If something is client-side but feature-specific, it still belongs in `src/components/` or `src/app/<feature>/ui/`, not `framework/`.
- **Don't reach for `next/headers` in client components.** Use `document.cookie` (or a hook around it) for client-side state; reserve `cookies()` for Server Components and route handlers.
- **Don't add CSP rules in mock mode without first adding a CSP middleware.** Pact-web doesn't ship CSP yet; loosening nothing accomplishes nothing.

## Related skills

- `pact-mock-data` — how to structure per-feature `mock/data` + `mock/handlers` against the central `db`.

# pact-web - architecture

C4 Level 3/4 views of pact-web, plus its dynamic views.
Like the README diagram, these show the target architecture the project is converging on; pieces not yet merged are marked "(planned)".

## Component diagram (C4 L3)

```mermaid
C4Component
    title pact-web - Components
    Container_Boundary(web, "pact-web (Next.js)") {
        Component(authroutes, "(auth) route group", "app/(auth)", "login, register, forgot/reset password, verify email - rendered logged-out")
        Component(approutes, "(app) route group", "app/(app)", "dashboard, test-lab, per-service consoles (filter, redactor, policy, audit, files, benchmark, classifier, consensus, gateway), settings - every layout validates the session server-side")
        Component(authapi, "Auth route handlers", "app/api/auth/*", "login / logout / mfa / password flows; call pact-auth over Connect RPC and set the pact_session cookie")
        Component(proxy, "Gateway edge proxies", "app/api/pact/* + app/v1/* via src/lib/proxy/proxy_to_gateway.ts", "One shared core: translates the pact_session cookie into Authorization: Bearer, forwards to pact-gateway, propagates rotated session tokens back as cookies")
        Component(session, "Session validation", "src/framework/auth/pact_auth/session.ts", "requireSession / validateSessionFromCookies - calls pact-auth ValidateSession on every invocation, fail-closed; middleware cookie checks are an optimization, not the barrier")
        Component(features, "Feature slices", "src/app/<feature>/{domain, ui, mock, test}", "One slice per console; domain/ is headless (types, helpers, hooks), ui/ renders, mock/ seeds MSW, test/ is canonical for tests")
        Component(codegen, "Generated clients", "src/__codegen__/{proto, rest, schema}", "Connect client for pact-auth; per-tag REST fetchers generated from the gateway OpenAPI spec; vendored decision-schema artifacts - never hand-edited")
        Component(msw, "MSW mock layer", "src/framework/msw", "dev:mock runs the full UI against handlers seeded from feature mock/ modules; fetch gate holds requests until the worker is ready")
        Component(fw, "Framework", "src/framework/{http, swr, theme, motion, helpers}", "Axios base, SWR config, theming, motion presets, environment helpers")
    }
    System_Ext(user, "Console user", "browser")
    System_Ext(gw, "pact-gateway", "REST API")
    System_Ext(auth, "pact-auth", "Connect RPC")

    Rel(user, authroutes, "logged-out flows")
    Rel(user, approutes, "console")
    Rel(authroutes, authapi, "form posts")
    Rel(authapi, auth, "StartLogin / Register / ...", "Connect RPC")
    Rel(approutes, session, "requireSession per request")
    Rel(session, auth, "ValidateSession", "Connect RPC")
    Rel(approutes, features, "compose")
    Rel(features, codegen, "generated hooks/fetchers")
    Rel(codegen, proxy, "fetch /api/pact/*")
    Rel(proxy, gw, "Bearer-authenticated REST")
    Rel(features, msw, "handlers in dev:mock")
    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Class diagram (C4 L4) - session and proxy core

```mermaid
classDiagram
    class Session {
        +userId string
        +expiresAt Date
    }
    class requireSession {
        <<server-only>>
        redirects to /login when invalid
    }
    class validateSessionFromCookies {
        <<server-only>>
        ValidateSession RPC per call - fail closed
        returns null on any failure
        mock mode returns a synthetic session
    }
    class ProxyToGatewayOptions {
        +upstreamPath string (must start with /v1/)
        +forwardRefreshHeader bool
        caller owns method allowlist + path building
    }
    class proxyToGateway {
        pact_session cookie -> Authorization Bearer
        propagates x-pact-new-* rotation headers
        single shared core for every proxy route
    }
    class FeatureSlice {
        <<convention>>
        domain/ headless types + hooks
        ui/ components (feature-prefixed names)
        mock/ MSW handlers + fixtures
        test/ canonical test location
    }
    class GeneratedRestClient {
        <<src/__codegen__/rest>>
        per-tag fetchers + SWR hooks
        regenerated from the gateway OpenAPI spec
    }
    class DecisionSchema {
        <<src/__codegen__/schema>>
        vendored decision payload schema artifacts
        typed check-response parsing replaces casts (planned)
    }

    requireSession --> validateSessionFromCookies
    validateSessionFromCookies --> Session
    proxyToGateway --> ProxyToGatewayOptions
    FeatureSlice --> GeneratedRestClient : data via
    FeatureSlice --> DecisionSchema : decision payloads
```

The cookie is never trusted directly: only what pact-auth's ValidateSession says about it counts, so a stale or forged cookie degrades to a login redirect rather than a stale identity.

## Sequence - login

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant L as /login page
    participant R as /api/auth/login
    participant A as pact-auth
    participant P as (app) layout

    B->>L: credentials
    L->>R: POST
    R->>A: StartLogin (Connect RPC)
    alt MFA required
        A-->>R: challenge
        R-->>B: MFA step (factor selection + verify)
    else success
        A-->>R: session + refresh token pair
        R-->>B: Set-Cookie pact_session, redirect
    end
    B->>P: GET /dashboard
    P->>A: ValidateSession (requireSession)
    A-->>P: valid + userId
    P-->>B: rendered console
```

## Sequence - proxied API call with session rotation

```mermaid
sequenceDiagram
    autonumber
    participant C as SWR hook (generated client)
    participant PR as /api/pact/... proxy route
    participant CORE as proxy_to_gateway
    participant GW as pact-gateway

    C->>PR: fetch (cookie rides along)
    alt dev:mock
        Note over C: MSW intercepts in the browser -<br/>request never leaves the page
    end
    PR->>CORE: upstreamPath + options
    CORE->>CORE: pact_session cookie -> Authorization: Bearer
    CORE->>GW: forward request
    GW-->>CORE: response (+ x-pact-new-session/refresh/expiry headers near expiry)
    alt rotation headers present
        CORE-->>C: response + Set-Cookie (rotated pact_session)
    else
        CORE-->>C: response unchanged
    end
```

Rotation is transparent to feature code: the SPA never handles raw tokens - the proxy layer owns the cookie-to-Bearer translation and the rotated pair, so a new endpoint gets both for free by declaring a route on the shared core.

## State diagram - client session

```mermaid
stateDiagram-v2
    [*] --> logged_out
    logged_out --> authenticating : login submit
    authenticating --> mfa_challenge : factor required
    mfa_challenge --> active : factor verified
    authenticating --> active : cookie set
    authenticating --> logged_out : bad credentials
    active --> active : ValidateSession ok per request
    active --> rotated : near-expiry call returns new token pair
    rotated --> active : cookie replaced transparently
    active --> logged_out : logout / expiry / revocation - fail-closed redirect
    note right of active
        every server render revalidates -
        the cookie is an opaque handle,
        never a trusted identity
    end note
```

## State diagram - a Test Lab run

```mermaid
stateDiagram-v2
    [*] --> composing : prompt + attack type chosen
    composing --> running : check submitted via the proxy
    running --> running : per-layer verdicts fill in (filter, classifier, ...)
    running --> decided_allow : pipeline allows
    running --> decided_block : a layer blocks
    running --> failed : gateway unreachable / non-2xx
    decided_allow --> saved : optionally saved to the corpus
    decided_block --> saved
    saved --> [*]
    decided_allow --> [*]
    decided_block --> [*]
    failed --> [*] : error surfaced, run kept in history
```

The run machine lives in the test-lab feature's domain layer (extraction in progress) so the dashboard quick-probe and the full workbench share one implementation instead of drifting copies.

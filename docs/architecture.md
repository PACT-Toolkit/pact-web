# pact-web - architecture

C4 Level 3/4 views of pact-web, plus its dynamic views.
Like the README diagram, these show the target architecture the project is converging on; pieces not yet merged are marked "(planned)".

## Component diagram (C4 L3)

```mermaid
flowchart TB
    user(["<b>Console user</b><br/><i>browser</i>"]):::person

    subgraph web["pact-web (Next.js)"]
        authroutes["<b>(auth) route group</b><br/><i>app/(auth)</i><br/>login, register, forgot/reset password,<br/>verify email - rendered logged-out"]:::comp
        approutes["<b>(app) route group</b><br/><i>app/(app)</i><br/>dashboard, test-lab, per-service consoles (filter, redactor,<br/>policy, audit, files, benchmark, classifier, consensus, gateway),<br/>settings - every layout validates the session server-side"]:::comp
        authapi["<b>Auth route handlers</b><br/><i>app/api/auth/*</i><br/>login / logout / mfa / password flows; call pact-auth over<br/>Connect RPC and set the pact_session cookie"]:::comp
        proxy["<b>Gateway edge proxies</b><br/><i>app/api/pact/* + app/v1/* via src/lib/proxy/proxy_to_gateway.ts</i><br/>one shared core: translates the pact_session cookie into<br/>Authorization: Bearer, forwards to pact-gateway, propagates<br/>rotated session tokens back as cookies"]:::comp
        session["<b>Session validation</b><br/><i>src/framework/auth/pact_auth/session.ts</i><br/>requireSession / validateSessionFromCookies - calls pact-auth<br/>ValidateSession on every invocation, fail-closed; middleware<br/>cookie checks are an optimization, not the barrier"]:::comp
        features["<b>Feature slices</b><br/><i>src/app/{feature}/{domain, ui, mock, test}</i><br/>one slice per console; domain/ is headless (types, helpers,<br/>hooks), ui/ renders, mock/ seeds MSW, test/ is canonical for tests"]:::comp
        codegen["<b>Generated clients</b><br/><i>src/__codegen__/{proto, rest, schema}</i><br/>Connect client for pact-auth; per-tag REST fetchers generated<br/>from the gateway OpenAPI spec; vendored decision-schema<br/>artifacts - never hand-edited"]:::comp
        msw["<b>MSW mock layer</b><br/><i>src/framework/msw</i><br/>dev:mock runs the full UI against handlers seeded from<br/>feature mock/ modules; fetch gate holds requests<br/>until the worker is ready"]:::comp
        fw["<b>Framework</b><br/><i>src/framework/{http, swr, theme, motion, helpers}</i><br/>Axios base, SWR config, theming, motion<br/>presets, environment helpers"]:::comp
    end

    gw["<b>pact-gateway</b><br/><i>REST API</i>"]:::ext
    auth["<b>pact-auth</b><br/><i>Connect RPC</i>"]:::ext

    user -->|logged-out flows| authroutes
    user -->|console| approutes
    authroutes -->|form posts| authapi
    authapi -->|"StartLogin / Register<br/>/ ... (Connect RPC)"| auth
    approutes -->|requireSession per request| session
    session -->|ValidateSession| auth
    approutes -->|compose| features
    features -->|generated hooks/fetchers| codegen
    codegen -->|fetch /api/pact/*| proxy
    proxy -->|Bearer-authenticated REST| gw
    features -->|handlers in dev:mock| msw

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef comp fill:#85bbf0,stroke:#5d82a8,color:#000000
    classDef ext fill:#8a8a8a,stroke:#666666,color:#ffffff
    style web fill:none,stroke:#444444,stroke-dasharray:5 5
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
        typed check-response parsing replaces casts
    }

    requireSession ..> validateSessionFromCookies
    validateSessionFromCookies ..> Session
    proxyToGateway ..> ProxyToGatewayOptions
    FeatureSlice --> GeneratedRestClient : data via
    FeatureSlice --> DecisionSchema : decision payloads
```

The cookie is never trusted directly: only what pact-auth's ValidateSession says about it counts, so a stale or forged cookie degrades to a login redirect rather than a stale identity.

## Class diagram (C4 L4) - feature-slice anatomy

Every console under `src/app/{feature}` repeats the same shape.
The route page renders the feature's workbench component, the domain layer holds the headless types and hooks, and the mock layer seeds MSW so `dev:mock` runs the full UI offline.
The classes here are the conventions each slice instantiates; the diagrams after this one show the concrete domain layer per feature.

```mermaid
classDiagram
    class FeaturePage {
        <<route>>
        one page per console under app
        session validated by the app layout
        renders the feature workbench
    }
    class FeatureComponents {
        <<ui/>>
        feature-prefixed PascalCase .tsx
        one component per file
    }
    class UiTypes {
        <<ui/types.ts>>
        visual-state types only
        run + save statuses, chips
    }
    class DomainModules {
        <<domain/>>
        snake_case headless .ts files
        API shapes, helpers, constants
        never any JSX
    }
    class DomainHooks {
        <<domain/use_x.ts>>
        wrap generated SWR hooks
        own run + save state machines
    }
    class GeneratedRestClient {
        <<src/__codegen__/rest>>
        per-tag orval SWR hooks + fetchers
        never hand-edited
    }
    class httpClient {
        <<src/framework/http>>
        shared Axios instance
        401 redirects to /login
        raw useSWR fetchers use it
    }
    class proxyToGateway {
        <<src/lib/proxy>>
        shared /v1 and /api/pact edge
        see the core diagram above
    }
    class MockData {
        <<mock/data>>
        mock instantiators + seeders
        createXMockData(db) convention
    }
    class MockHandlers {
        <<mock/handlers>>
        MSW routes on MSW_PACT_BASE
        read and write db entities
    }
    class db {
        <<mocks/data/dbFactory.ts>>
        one repository per entity
        seeded once at module load
    }
    class MockRepository~T~ {
        <<mocks/data/repository.ts>>
        +create(overrides) T
        +update(criteria, mutate)
        +delete(criteria)
        +getAll()
        +findFirst(criteria)
        +findMany(criteria)
    }

    FeaturePage ..> FeatureComponents : renders
    FeatureComponents ..> DomainHooks : call
    FeatureComponents ..> DomainModules : helpers + types
    FeatureComponents ..> UiTypes : visual state
    DomainModules ..> UiTypes : may import
    DomainHooks ..> DomainModules : parse + build
    DomainHooks ..> GeneratedRestClient : wrap
    DomainHooks ..> httpClient : raw useSWR paths
    GeneratedRestClient ..> proxyToGateway : fetch /v1 or<br/>/api/pact
    GeneratedRestClient ..> MockHandlers : dev mock intercept
    MockHandlers ..> db : read/write
    db --> MockRepository~T~ : one per entity
    db ..> MockData : runs seeders
    MockData ..> MockRepository~T~ : create(overrides)
```

The generated clients fetch `/v1/{account,audit,files}` or `/api/pact/gateway/v1` depending on the tag - both are routes on the shared proxy core, so every feature gets cookie-to-Bearer translation and session rotation for free.

## Class diagram (C4 L4) - decision vocabulary and its consoles

Six features render the same `pact.decisions` payload, so the vocabulary lives in `src/lib/decisions` rather than in any one slice.
The audit workbench decodes every topic it knows through `AUDIT_TOPIC_REGISTRY`, and the dashboard derives its live stream and severity buckets from the same payloads.

```mermaid
classDiagram
    direction LR
    namespace SharedDecisionLib {
        class DecisionPayload {
            <<type>>
            Partial PactDecisions
            +decision allow or block
            +engine string
            +reason string
            +filter FilterDecision
            +classifier ClassifierDecision
            +consensus ConsensusDecision
            +redactor RedactorDecision
            +policy PolicyDecision
        }
        class parseDecisionPayload {
            <<function>>
            JSON parse, null on malformed
        }
    }
    namespace Audit {
        class AUDIT_TOPIC_REGISTRY {
            <<const>>
            pact.auth decodeAuthPayload
            pact.account decodeAccountPayload
            pact.files decodeFilesPayload
            pact.decisions parseDecisionPayload
            pact.policy decoder (planned)
        }
        class AuditEventVariant {
            <<union>>
            decisions or auth or account
            or files or unknown
        }
        class decodeAuditEventVariant {
            <<function>>
            total, never throws
            unknown topics fall through
        }
    }
    namespace Dashboard {
        class useDashboardPipelineStats {
            <<hook>>
            live events every 10s
            stat widgets every 30s
        }
        class DecisionRecord {
            <<type>>
            +event AuditEvent
            +dp DecisionPayload
        }
        class decisionSeverity {
            <<function>>
            blocked, flagged or clean
        }
        class checkResponseToDecisionPayload {
            <<function>>
            quick-probe bridge from /v1/check
        }
    }
    namespace GeneratedRestHooks {
        class useQueryAuditEvents {
            <<generated hook>>
        }
        class useQueryDecisionStats {
            <<generated hook>>
        }
    }

    parseDecisionPayload ..> DecisionPayload : returns
    AUDIT_TOPIC_REGISTRY --> parseDecisionPayload : decisions decoder
    decodeAuditEventVariant ..> AUDIT_TOPIC_REGISTRY : looks up
    decodeAuditEventVariant ..> AuditEventVariant : returns
    AuditEventVariant --> DecisionPayload : decisions payload
    DecisionRecord --> DecisionPayload : dp
    useDashboardPipelineStats ..> useQueryAuditEvents : live stream
    useDashboardPipelineStats ..> useQueryDecisionStats : headline stats
    useDashboardPipelineStats ..> DecisionRecord : parseDecisions()
    decisionSeverity ..> DecisionPayload : buckets
    checkResponseToDecisionPayload ..> DecisionPayload : returns
```

`AUDIT_TOPIC_REGISTRY` is the single source of truth for the topics the audit console can render: the topic dropdown, the decoder dispatch, and the variant kinds all derive from its entries.
A `pact.policy` decoder is the one planned addition - until it lands, that topic falls through to the `unknown` variant and renders as raw JSON.

## Class diagram (C4 L4) - engine console domain records

The filter, classifier, consensus, and redactor consoles each pair the shared payload with their own record type and extraction helper.
Their workbenches fetch `pact.decisions` rows through the generated `useQueryAuditEvents` hook and map them with the extract functions shown here.

```mermaid
classDiagram
    direction LR
    namespace SharedDecisionLib {
        class DecisionPayload {
            <<type>>
            see the vocabulary
            diagram above
        }
        class parseDecisionPayload {
            <<function>>
            JSON parse, null on malformed
        }
    }
    namespace Filter {
        class useFilterDecisionStats {
            <<hook>>
            filter slice of decision stats
        }
        class filter_decision {
            <<module>>
            +parsePayload
            +formatTimestamp()
            +PAGE_SIZE
        }
        class filter_false_positive {
            <<module>>
            +buildAnnotateDecisionRequest()
            +isFlaggedFalsePositive()
            +applyOptimisticAnnotationFlag()
            +fetchDecisionAnnotations()
        }
        class filter_test_rule {
            <<module>>
            +validateTestRuleForm()
            +buildTestRuleRequest()
            +isRuleMatch()
        }
    }
    namespace Classifier {
        class ClassifierRecord {
            <<type>>
            +classifier ClassifierSubObject
            +decision string
            +consensusArbitrated boolean
            +latencyMs number
            +rawPayload string
        }
        class extractClassifierRecords {
            <<function>>
        }
        class classifier_label {
            <<module>>
            +availableLabelAction()
            +buildLabelVerdictRequest()
        }
    }
    namespace Consensus {
        class ConsensusRecord {
            <<type>>
            +consensus ConsensusSubObject
            +classifierEngine string
            +latencyMs number
            +rawPayload string
        }
        class extractConsensusRecords {
            <<function>>
        }
        class consensus_flags {
            <<module>>
            +isSplit()
            +isNoQuorum()
            +isFailOpen()
            +isLowConfidence()
            +isFlaggedRecord()
        }
    }
    namespace Redactor {
        class RedactorRecord {
            <<type>>
            +redactor RedactorSubObject
            +engine string
            +latencyMs number
            +rawPayload string
        }
        class extractRedactorRecords {
            <<function>>
        }
        class applyRedaction {
            <<function>>
            masks spans in the preview
        }
    }

    extractClassifierRecords ..> parseDecisionPayload : per row
    extractClassifierRecords ..> ClassifierRecord : returns
    extractConsensusRecords ..> parseDecisionPayload : per row
    extractConsensusRecords ..> ConsensusRecord : returns
    extractRedactorRecords ..> parseDecisionPayload : per row
    extractRedactorRecords ..> RedactorRecord : returns
    consensus_flags ..> ConsensusRecord : flags
    ClassifierRecord --> DecisionPayload : classifier sub-object
    ConsensusRecord --> DecisionPayload : consensus sub-object
    RedactorRecord --> DecisionPayload : redactor sub-object
    filter_decision ..> parseDecisionPayload : re-exports as<br/>parsePayload
```

The filter console's false-positive flags ride the audit tag's `annotateDecision` and `listDecisionAnnotations` fetchers, keyed on request id, and its rule sandbox posts through the generated `useTestRule` hook.
`buildLabelVerdictRequest` feeds the classifier tag's `useLabelVerdict` mutation, and `applyRedaction` previews the spans returned by the shared `/v1/check` probe.

## Class diagram (C4 L4) - test lab and benchmark

The Test Lab and the benchmark console share the gateway's benchmark tag: measured runs, Test Lab run history, and the attack corpus.
`useTestLabRun` owns the run state machine, validates every `/v1/check` response with `parseCheckResponse`, and saves history optimistically through the generated benchmark hooks.

```mermaid
classDiagram
    direction LR
    namespace TestLab {
        class CheckResponse {
            <<type>>
            +decision allow or block
            +reason string
            +filter_rule_id string
            +latency_ms number
            +request_id string
            +_mock_layers MockLayer list
        }
        class parseCheckResponse {
            <<function>>
            parse, don't cast
            throws CheckResponseParseError
        }
        class TestRun {
            <<type>>
            +id string
            +input string
            +attackType string
            +decision allow or block
            +latencyMs number
            +timestamp string
        }
        class useTestLabRun {
            <<hook>>
            +status RunStatus
            +layers LayerState list
            +result CheckResponse
            +history TestRun list
            +runCheck()
            +forceBlockLayer()
        }
        class useSaveToCorpus {
            <<hook>>
            +saveState SaveState
            +saveToCorpus()
        }
        class useTestLabCorpusExamples {
            <<hook>>
            +examples AttackChip list
            Next.js stand-in route today
            orval hook once the gateway
            spec covers it (planned)
        }
    }
    namespace Benchmark {
        class BenchmarkRun {
            <<type>>
            +corpus_version string
            +detection_rate number
            +fp_rate number
            +p50_latency number
            +p99_latency number
            +ran_at number
            +row_count number
        }
        class useBenchmarkRuns {
            <<hook>>
            trend window via TrendDateRange
        }
        class benchmark_comparison {
            <<module>>
            +compareRuns()
            +defaultComparisonPair()
            +formatMetric()
        }
        class benchmark_job {
            <<module>>
            +validateCorpusFile()
            +isRowCorrect()
        }
        class useBenchmarkCorpusLibrary {
            <<hook>>
            corpus dataset summaries
        }
    }
    namespace GeneratedRestHooks {
        class RestCheck {
            <<src/__codegen__/rest/check>>
            +checkContent()
            +useCheckContent()
        }
        class RestBenchmark {
            <<src/__codegen__/rest/benchmark>>
            +useListBenchmarkRuns()
            +useListBenchmarkTestLabRuns()
            +saveBenchmarkTestLabRun()
            +useSaveBenchmarkCorpusEntry()
            +useGetBenchmarkCorpusLibrarySummary()
            +useGetBenchmarkJob()
            +useSubmitBenchmarkJob()
        }
    }

    useTestLabRun --> CheckResponse : result state
    useTestLabRun --> TestRun : history rows
    useTestLabRun ..> parseCheckResponse : validates via
    parseCheckResponse ..> CheckResponse : returns
    useTestLabRun ..> RestCheck : checkContent()
    useTestLabRun ..> RestBenchmark : run history<br/>save + list
    useSaveToCorpus ..> RestBenchmark : save corpus entry
    useSaveToCorpus ..> CheckResponse : reads result
    useBenchmarkRuns ..> RestBenchmark : list runs
    useBenchmarkRuns ..> BenchmarkRun : returns rows
    useBenchmarkCorpusLibrary ..> RestBenchmark : corpus summary
    benchmark_comparison ..> BenchmarkRun : compares pairs
    benchmark_job ..> RestBenchmark : job row types
```

The attack-example chips still come from a Next.js stand-in route wrapped by `useTestLabCorpusExamples`.
The generated corpus-examples hook replaces it once the gateway OpenAPI spec covers the endpoint (planned).

## Class diagram (C4 L4) - control plane and platform features

Gateway configuration, policy authoring, file uploads, account settings, and the auth domain helpers.
The gateway probe builders (sandbox, diagnostics, spotlight) produce request bodies for the same shared `/v1/check` fetcher the Test Lab uses.

```mermaid
classDiagram
    direction LR
    namespace Gateway {
        class GatewayConfig {
            <<type>>
            +classifierEnforceMode
            +vectorEnforceMode
            +consensusMode
            +consensusThreshold
            +sandboxEnabled
            +diagnosticsEnabled
            +spotlightFormat
            +requestTimeoutSeconds
        }
        class useGatewayConfig {
            <<hook>>
        }
        class gateway_enforcement_patch {
            <<module>>
            +buildEnforcementPatch()
            +applyOptimisticEnforcementPatch()
            +isFlipToEnforce()
        }
        class gateway_sandbox {
            <<module>>
            +buildSandboxProbeRequest()
            +verdictBadgeClass()
        }
        class gateway_diagnostics {
            <<module>>
            +buildDiagnosticsProbeRequest()
            +causalSpansToHighlights()
        }
        class gateway_spotlight {
            <<module>>
            +buildSpotlightProbeRequest()
            +trustBadgeClass()
        }
    }
    namespace Policy {
        class PolicyRule {
            <<type>>
            gateway wire type alias
            status draft to revoked
        }
        class usePolicyRules {
            <<hook>>
        }
        class usePolicyRuleActions {
            <<hook>>
            +publishRule()
            +revokeRule()
            throws RuleActionError
        }
        class usePolicyEvents {
            <<hook>>
        }
        class policy_token {
            <<module>>
            +buildIssueTokenRequest()
            +isIssueTokenInputValid()
            +formatExpiry()
        }
    }
    namespace Files {
        class uploadFile {
            <<function>>
            presign, PUT, confirm
        }
        class UploadFileResult {
            <<union>>
            ok with fileId
            or failure step + status
        }
        class files_upload {
            <<module>>
            +isTerminal()
            +humanSize()
            +POLL_INTERVAL_MS
        }
    }
    namespace Account {
        class account_validation_schema {
            <<module>>
            +profileFormSchema
            +ProfileFormData
            +PROFILE_FIELD_TO_MASK
        }
    }
    namespace Auth {
        class auth_validation_schema {
            <<module>>
            +loginSchema
            +registerSchema
            +forgotPasswordSchema
            +resetPasswordSchema
        }
        class webauthn {
            <<module>>
            +signInWithPasskey()
            +enrollPasskey()
            +PasskeyError
        }
        class auth_broadcast {
            <<module>>
            +notifyVerified()
            +subscribeToVerified()
            +notifyPasswordResetCompleted()
        }
    }
    namespace GeneratedRestHooks {
        class RestConfig {
            <<src/__codegen__/rest/config>>
            +useGetConfig()
            +patchEnforcement()
        }
        class RestRules {
            <<src/__codegen__/rest/rules>>
            +useListRules()
            +createRule()
            +publishRule()
            +revokeRule()
        }
        class RestPolicy {
            <<src/__codegen__/rest/policy>>
            +issueToken()
        }
        class RestAudit {
            <<src/__codegen__/rest/audit>>
            +useQueryPolicyEvents()
        }
        class RestFiles {
            <<src/__codegen__/rest/files>>
            +useListFiles()
            +requestFileUpload()
            +confirmFileUpload()
            +deleteFile()
        }
        class RestAccount {
            <<src/__codegen__/rest/account>>
            +useGetAccountProfile()
            +useUpdateAccountProfile()
            +useGetAccountPreferences()
            +useUpdateAccountPreferences()
            +useGetAccountConsents()
            +useRecordAccountConsent()
            +useExportAccountData()
            +useRequestAccountErasure()
        }
    }

    useGatewayConfig ..> RestConfig : useGetConfig
    useGatewayConfig ..> GatewayConfig : returns
    gateway_enforcement_patch ..> RestConfig : patchEnforcement
    gateway_enforcement_patch ..> GatewayConfig : optimistic patch
    usePolicyRules ..> RestRules : useListRules
    usePolicyRules ..> PolicyRule : returns
    usePolicyRuleActions ..> RestRules : publish + revoke
    usePolicyEvents ..> RestAudit : policy events
    policy_token ..> RestPolicy : issueToken
    uploadFile ..> RestFiles : presign + confirm
    uploadFile ..> UploadFileResult : returns
    account_validation_schema ..> RestAccount : validates forms for
```

The account settings forms pair `profileFormSchema` with the account tag's profile, preferences, consents, export, and erasure hooks.
Auth's domain modules never touch the gateway proxy: the forms post to the `/api/auth/*` route handlers, which speak Connect RPC to pact-auth (see the component diagram), and `auth_broadcast` fans auth events out across open tabs.

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
    R->>A: Login (Connect RPC)
    alt MFA required
        A-->>R: challenge
        R-->>L: MFA required
        L-->>B: MFA step (factor selection + verify)
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
        CORE-->>PR: response + Set-Cookie (rotated pact_session)
        PR-->>C: response + Set-Cookie (rotated pact_session)
    else
        CORE-->>PR: response unchanged
        PR-->>C: response unchanged
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
    mfa_challenge --> logged_out : challenge expired /<br/>cancelled
    authenticating --> active : cookie set
    authenticating --> logged_out : bad credentials
    active --> active : ValidateSession ok per<br/>request
    active --> rotated : near-expiry call<br/>returns new token pair
    rotated --> active : cookie replaced<br/>transparently
    active --> logged_out : logout / expiry /<br/>revocation -<br/>fail-closed redirect
    note right of active
        every server
        render revalidates -
        the cookie is an
        opaque handle,
        never a trusted
        identity
    end note
```

## State diagram - a Test Lab run

```mermaid
stateDiagram-v2
    [*] --> composing : prompt + attack type<br/>chosen
    composing --> running : check submitted via<br/>the proxy
    running --> running : per-layer<br/>verdicts fill in
    running --> decided_allow : pipeline allows
    running --> decided_block : a layer blocks
    running --> failed : gateway unreachable /<br/>non-2xx
    decided_allow --> saved : optionally saved to<br/>the corpus
    decided_block --> saved
    saved --> [*]
    decided_allow --> [*]
    decided_block --> [*]
    failed --> [*] : error surfaced, run<br/>kept in history<br/>(planned)
```

The run machine lives in the test-lab feature's domain layer (extraction in progress) so the dashboard quick-probe and the full workbench share one implementation instead of drifting copies.

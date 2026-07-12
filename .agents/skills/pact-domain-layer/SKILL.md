# pact-domain-layer

Where to put types, constants, and helpers within a pact-web feature folder.

## Folder anatomy recap

```
src/app/{feature}/
├── domain/          ← business logic, API contracts, derived constants
├── ui/              ← React components only
│   └── types.ts     ← UI-state types used across components in this feature
├── mock/            ← MSW handlers + seed data
└── index.ts         ← barrel (public API)
```

## What belongs in `domain/`

| Belongs in `domain/` | Stays in `ui/types.ts` |
|---|---|
| API payload / response shapes (`CheckResponse`, `DecisionPayload`) | Visual-state types tied to a component (`LayerState`, `SaveState`) |
| Business-logic records (`TestRun`) | UI-state machine types (`RunStatus`) |
| Inference / transformation helpers (`applyMockLayers`, `applyLiveLayers`, `parseDecisionPayload`) | UI-specific chip/option types (`AttackChip`) |
| Domain constants (pipeline stage definitions `BLANK_LAYERS`, seed chip list `STATIC_CHIPS`) | |
| Validation schemas | |

Rule of thumb: if the value could be unit-tested without rendering anything, it goes in `domain/`.

## `domain/` is headless

`domain/` may hold plain modules and React hooks - anything that does not render.
It must never hold JSX.

| Allowed in `domain/` | Not allowed in `domain/` |
|---|---|
| Plain functions, constants, types | Any file that returns JSX |
| React hooks without JSX (`useMemo`, `useCallback`, `useSyncExternalStore`, hooks wrapping SWR/orval) | `.tsx` files (domain files are always `.ts`) |
| `'use client'`, but only on a hook file that needs browser APIs or React runtime state (e.g. `useSyncExternalStore` for `navigator.credentials`, a debounced fetch with `useState`) | React component definitions |
| A React import, when the file is a hook | Rendering, even conditionally |

Examples already in the codebase: `src/app/auth/domain/use_has_mounted.ts`, `use_passkey_prompt_hidden.ts`, `use_password_breach_warning.ts`, and `use_webauthn_supported.ts` are `'use client'` hooks with React imports and zero JSX - they belong in `domain/` under this rule.
`src/app/benchmark/domain/use_benchmark_runs.ts`, `use_benchmark_corpus_library.ts`, `src/app/dashboard/domain/dashboard_pipeline_stats.ts`, and `src/app/policy/domain/use_policy_events.ts`, `use_policy_rules.ts` are plain (no `'use client'`) hooks wrapping generated SWR hooks - same rule, no directive needed because they don't touch browser-only APIs.

This is machine-enforced: `eslint.config.mjs` forbids `.tsx` files and JSX syntax (`JSXElement`/`JSXFragment`) under `src/app/*/domain/**`.

## File naming

Files inside `domain/` use snake_case: `{feature}_{concern}.ts`.

| File | Owns |
|---|---|
| `test_lab_check.ts` | Gateway API types, layer inference helpers, pipeline constants |
| `audit_event_variant.ts` | Audit topic registry, discriminated `AuditEventVariant` decoding |
| `account_validation_schema.ts` | Yup schemas, derived form types |

One file per concern - don't create a catch-all `types.ts` in `domain/`.

## Import direction

```
domain/ → ui/types.ts   OK  (domain may import shared UI-state types)
ui/     → domain/        OK  (components import domain types and helpers)
domain/ → ui/components  NO  (domain must not import React components)
```

## Checklist before creating a new file in a feature

1. Is it a React component? → `ui/{FeaturePrefix}Name.tsx`
2. Is it a UI-only state type used by ≥2 components? → `ui/types.ts`
3. Is it an API shape, business record, helper, or constant? → `domain/{feature}_{concern}.ts`
4. Is it mock data or an MSW handler? → `mock/data/` or `mock/handlers/`
5. Should outside consumers import it? → re-export from `index.ts`

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

## File naming

Files inside `domain/` use snake_case: `{feature}_{concern}.ts`.

| File | Owns |
|---|---|
| `test_lab_check.ts` | Gateway API types, layer inference helpers, pipeline constants |
| `audit_decision_payload.ts` | `DecisionPayload` shape, `parseDecisionPayload` parser |
| `account_validation_schema.ts` | Yup schemas, derived form types |

One file per concern — don't create a catch-all `types.ts` in `domain/`.

## Import direction

```
domain/ → ui/types.ts   ✓  (domain may import shared UI-state types)
ui/     → domain/        ✓  (components import domain types and helpers)
domain/ → ui/components  ✗  (domain must not import React components)
```

`domain/` files must not have `'use client'` or any React import.

## Checklist before creating a new file in a feature

1. Is it a React component? → `ui/{FeaturePrefix}Name.tsx`
2. Is it a UI-only state type used by ≥2 components? → `ui/types.ts`
3. Is it an API shape, business record, helper, or constant? → `domain/{feature}_{concern}.ts`
4. Is it mock data or an MSW handler? → `mock/data/` or `mock/handlers/`
5. Should outside consumers import it? → re-export from `index.ts`

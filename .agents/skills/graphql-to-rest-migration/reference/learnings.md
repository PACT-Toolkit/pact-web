# Migration Learnings

> This file grows after each migration retro. Read it before starting any migration.
> Newest entries at the top.

---

## Automation (2026-03-12)

**Phase**: 2 + 3 + 4 (combined)
**Migrated by**: agent

### Findings
- **[eventual-consistency]**: The automation REST backend uses eventual consistency — a GET immediately after a mutation returns stale data. Solved with SWR cache patching (`mutate(key, patchFn, { revalidate: false })`) followed by a delayed revalidation to eventually sync with the backend.
- **[delayed-revalidation-hook]**: Created `useDelayedRevalidation` hook at `src/framework/swr/use_delayed_revalidation.ts` — takes an SWR cache key and optional `{ delay }` (default 2500ms), returns `{ scheduleRevalidation, cancelRevalidation }`. Intentionally does NOT clear the timer on unmount because mutation flows often close the initiating component (e.g. dialog) before revalidation fires. Debounces on repeated calls.
- **[axios-response-envelope]**: SWR caches `AxiosResponse<T>`, not just `T`. When patching the cache, always spread the full `AxiosResponse` envelope and only replace `.data` fields. Forgetting the envelope wrapper causes silent type mismatches.
- **[cache-key-helpers]**: Use the generated `getGetXKey()` functions from `src/__codegen__/rest/{service}` to build cache keys. These ensure the key matches the SWR fetcher key exactly — do NOT construct keys manually.
- **[optimistic-patterns]**: Three mutation patterns emerged: filter (delete), map (edit), append (create). All follow the same structure: `trigger()` → `mutate(key, patchFn, { revalidate: false })` → `scheduleRevalidation()`.

### Pattern changes
- Phase 3 now includes "Optimistic updates with eventual consistency" section with the `useDelayedRevalidation` pattern and code example.
- Added `Automation` to the reference implementations table in SKILL.md.

---

## User Switch (2026-03-09)

**Phase**: 2
**Migrated by**: agent

### Findings
- **[no-domain-types]**: Do NOT create domain types or mapper functions. Use the Swagger-generated types from `src/__codegen__/rest/{service}/types` directly. Only add a mapper if the REST shape is fundamentally incompatible with the UI — this is rare and must be justified.

### Pattern changes
- Phase 2 no longer includes "create domain types" — use generated types directly.

---

## Bankgiro (2026-03-04)

**Phase**: 2 + 3 + 4 (combined)
**Migrated by**: human + agent pair

### Findings
- **[challenge-pattern]**: REST BFFs return HTTP 418 with a `ChallengeErrorResponse` when user approval is needed. Do NOT build feature-specific challenge dialogs — use the shared `OutOfBandChallengeDialog`. See the `handling-rest-challenges` skill.
- **[validation-errors]**: REST BFFs return HTTP 422 with validation errors. Unlike 418 (which Axios resolves), 422 throws an `AxiosError` — catch and parse `error.response.data`.
- **[axios-418]**: The global Axios instance treats 418 as a successful response. The mutation response data must be inspected for `reasonCode === 'CHALLENGE_REQUESTED'`.
- **[proxy-passthrough]**: The HTTP proxy (`httpProxy.ts`) was updated to pass through 418 and 422 responses. This is a one-time infrastructure change.
- **[shared-auth-challenge]**: A new `auth-challenge` service was added to Orval config and schema for the challenge polling endpoints. This is reusable across all features.
- **[e2e-selectors]**: Challenge test IDs changed from feature-specific (e.g., `bankgiro-successful`) to shared (`oob-challenge-successful`). Update E2E tests accordingly.
- **[plusgiro-split]**: Bankgiro and Plusgiro have separate validate/payment endpoints. Use conditional logic based on the selected type.

### Pattern changes
- Phase 3 now includes challenge migration guidance — load `handling-rest-challenges` skill when the feature has approval flows.

_No migrations completed yet. First target: Insurance._

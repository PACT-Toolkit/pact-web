---
name: graphql-to-rest-migration
description: "Migrate features from GraphQL/Apollo to REST/Swagger (Orval + SWR). Use when asked to 'migrate to REST', 'migrate to swagger', 'replace GraphQL', or when working on GraphQL → Swagger migration issues."
---

# GraphQL → REST Migration

Migrate a Terra feature from GraphQL/Apollo to REST/Swagger (Orval + SWR) following the established 4-phase pattern.

## Before You Start

1. Load `vercel-react-best-practices` skill for React/Next.js performance patterns
2. Read `reference/learnings.md` in this skill directory — apply ALL learnings
3. Identify the feature's existing GraphQL files to understand scope

## Migration Phases

Every migration follows four phases. Each phase is a **separate Linear issue** with its own branch, PR, and Amp session.

Because each phase starts a fresh session, **always read `reference/learnings.md` first** — it's the only way prior migration knowledge carries over.

### Phase 1: Playwright E2E test coverage (safety net)

Ensure the feature has solid Playwright E2E test coverage **before touching anything**. These tests become your regression safety net — they must pass before AND after migration.

**Load the `writing-e2e-tests` skill** for detailed Playwright conventions, query priority order, and test patterns.

Key conventions:

- Test files: `src/app/{feature}/test/{feature}.spec.ts`
- Use `data-testid` (standard HTML attribute) — kebab-case, feature-prefixed (e.g., `insurance-list`, `insurance-list-item-{id}`)
- Reference test: `src/app/benefits/test/benefit.spec.ts`
- Zero custom commands — standard Playwright API only
- Test **user-visible behavior** only — never assert on GraphQL vs REST (tests must survive the data layer swap)

**⚠️ Do NOT proceed to Phase 2 until E2E tests pass on the existing GraphQL implementation.**

### Phase 2: Add REST schema alongside GraphQL (zero-risk, additive-only)

1. **Add service config** in `schema/{feature}/services.config.yaml`
2. **Run** `pnpm api:update` to fetch swagger + generate hooks in `src/__codegen__/rest/{service}/`
3. **Use the generated types directly** — import from `src/__codegen__/rest/{service}/types`. Do NOT create domain types or mapper functions unless the REST response shape is fundamentally incompatible with the UI (this is rare).
4. **Verify** generated hooks exist and types compile: `pnpm lint && pnpm build`

**⚠️ Do NOT touch any UI files in this phase.**

### Phase 3: Migrate UI to REST hooks

1. **Find all GraphQL hook usages** — search for imports from `data/__codegen__/`
2. **Replace one component at a time**:
   - Swap GraphQL hook → SWR hook from `src/__codegen__/rest/{service}/hooks`
   - Use the generated types directly — only add a thin mapper if the REST shape genuinely doesn't fit the UI
   - Ensure loading/error states still work (SWR uses `isLoading`/`error` vs Apollo's `loading`/`error`)
3. **Update MSW handlers** if the feature has mocks in `src/app/{feature}/mock/`
4. **Run** `pnpm lint && pnpm build` after each component

#### SWR vs Apollo patterns

| Apollo (before) | SWR (after) |
|---|---|
| `const { data, loading, error } = useQuery()` | `const { data, isLoading, error } = useGetX()` |
| `loading` | `isLoading` |
| `data?.featureName` | `data` (already unwrapped) |
| `refetch()` | `mutate()` from SWR |
| `fetchPolicy: 'cache-and-network'` | SWR revalidation (automatic) |

#### Optimistic updates with eventual consistency

Some REST backends use eventual consistency — an immediate GET after a mutation may return stale data. Use **SWR cache patching + delayed revalidation** to keep the UI responsive:

1. **After `trigger()`**, patch the SWR cache optimistically with `mutate(key, patchFn, { revalidate: false })`
2. **Schedule a delayed revalidation** using `useDelayedRevalidation` from `src/framework/swr/use_delayed_revalidation` to eventually sync with the backend

```tsx
import { useSWRConfig } from 'swr';
import { useDelayedRevalidation } from '@/src/framework/swr/use_delayed_revalidation';
import { getGetXKey, useDeleteX } from '@/src/__codegen__/rest/{service}';
import type { AxiosResponse } from 'axios';

const { mutate } = useSWRConfig();
const cacheKey = getGetXKey({ accountId });
const { scheduleRevalidation } = useDelayedRevalidation(cacheKey);
const { trigger } = useDeleteX(id);

const handleDelete = async () => {
  await trigger();

  await mutate(
    cacheKey,
    (current: AxiosResponse<GetXResponse> | undefined) => {
      if (!current) return current;
      return { ...current, data: { ...current.data, items: current.data.items.filter(…) } };
    },
    { revalidate: false }
  );

  scheduleRevalidation();
};
```

Key points:
- **SWR caches `AxiosResponse<T>`**, so always spread the full envelope and only replace `.data` fields
- `useDelayedRevalidation` defaults to 2500ms, debounces on repeated calls, and intentionally survives component unmount (mutation flows often close dialogs)
- Use `getGetXKey()` from the generated hooks to build the cache key — this ensures it matches the SWR fetcher key exactly
- Reference: `src/app/automation/ui/overview/AutomationDeleteButton.tsx` (delete), `AutomationEditButton.tsx` (edit), `create/AutomationCreateIncomeSorterRule.tsx` (create)

#### Challenge support (if the feature uses challenges)

If the feature has challenge/approval flows (e.g., payment confirmation), **load the `handling-rest-challenges` skill** for the complete pattern. Key points:

- Delete feature-specific challenge dialogs — use the shared `OutOfBandChallengeDialog` from `src/app/out_of_band_challenge`
- REST APIs return HTTP 418 for challenge requests (handled globally by Axios)
- REST APIs return HTTP 422 for validation errors (caught as `AxiosError`)
- Update E2E test selectors from feature-specific to `oob-challenge-*`

### Phase 4: Cleanup — Remove GraphQL

1. **Delete** GraphQL files:
   - `src/app/{feature}/data/*.graphql`
   - `src/app/{feature}/data/__codegen__/`
   - `schema/{feature}/schema.graphql`
2. **Run** `pnpm gql:codegen:update` to regenerate types without the feature
3. **Verify** no orphaned GraphQL types remain in `src/__codegen__/types.ts`
4. **Run** `pnpm lint && pnpm build`

## Reference implementations

| Feature | Status | Notes |
|---|---|---|
| Auth (auth-flow-mediator) | ✅ Complete | REST-only, no GraphQL to remove |
| Feature toggles | ✅ Complete | REST-only, no GraphQL to remove |
| Bankgiro | ✅ Complete | Full migration with challenge support. See `handling-rest-challenges` skill. |
| Automation | ✅ Complete | Full migration with optimistic updates + delayed revalidation. Reference for eventual consistency. |
| Insurance | 🎯 First full migration | Has GraphQL to replace |

## Post-migration retro

**After every migration PR is merged**, run a retro before moving to the next feature:

1. **What surprised you?** — API shape mismatches, missing fields, undocumented behavior
2. **What pattern worked?** — reusable mapper approach, component-by-component swap
3. **What broke?** — type errors, MSW gaps, loading state differences
4. **What should future migrations know?** — concrete, actionable findings

Append findings to `reference/learnings.md` using this format:

```markdown
## {Feature Name} ({date})

**Phase**: 1 / 2 / 3 / 4
**Migrated by**: human / agent / pair

### Findings
- **[category]**: description and what to do about it

### Pattern changes
- (any updates to the migration steps themselves)
```

If a finding affects the migration steps above, **also update this SKILL.md** — promote the learning into the instructions so future migrations benefit automatically.

## Conventions

- Branch naming: use the Linear issue branch name (e.g., `void-1813-insurance-add-rest-schema-alongside-graphql`)
- One PR per phase — keeps reviews small and rollback easy
- Domain types live in `src/app/{feature}/domain/types.ts` — never in `__codegen__/`
- **Use generated Swagger types directly** — do NOT create domain types or wrapper interfaces. Import from `src/__codegen__/rest/{service}/types`. Only create a mapper if the REST shape is fundamentally incompatible with the UI (this is rare and should be justified).

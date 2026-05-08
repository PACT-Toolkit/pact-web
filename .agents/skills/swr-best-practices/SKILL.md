---
name: swr-best-practices
description: SWR best practices for data fetching, mutations, revalidation, error handling, caching, subscriptions, middleware, and Next.js integration. Use this skill when writing, reviewing, or refactoring code that uses SWR. Grounded in the official SWR documentation (https://swr.vercel.app/docs).
license: MIT
metadata:
  source: https://swr.vercel.app/docs
  version: "1.2.0"
  swrVersion: ">=2.0.0"
---

# SWR Best Practices

Comprehensive SWR guidelines grounded in the official SWR documentation. 61 rules across 15 categories, prioritized by impact for automated refactoring and code review.

> **SWR version**: rules assume SWR ≥ 2.0. Some specifics (object key auto-serialization, single-arg array fetcher, `keepPreviousData`, `useSWRSubscription`, `preload`) require 2.x. Pin a minimum version in your project's `package.json` if downgrading is a risk.

## When to Apply

Reference these guidelines when:

- Writing or reviewing code that uses `useSWR`, `useSWRMutation`, `useSWRInfinite`, or `useSWRSubscription`
- Implementing optimistic updates or post-mutation revalidation
- Configuring `SWRConfig`, cache providers, or middleware
- Setting up server prefetching across the RSC / client boundary
- Migrating from a different data-fetching library to SWR

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Mutations & optimistic updates | CRITICAL | `mutation-` |
| 2 | Keys & conditional fetching | HIGH | `key-` |
| 3 | Error handling | HIGH | `error-` |
| 4 | Revalidation | HIGH | `revalidation-` |
| 5 | Configuration | MEDIUM-HIGH | `config-` |
| 6 | Performance | MEDIUM | `perf-` |
| 7 | Fetchers | MEDIUM | `fetcher-` |
| 8 | Next.js integration | MEDIUM | `nextjs-` |
| 9 | Pagination | MEDIUM | `pagination-` |
| 10 | Subscriptions | MEDIUM | `subscription-` |
| 11 | Cache | LOW-MEDIUM | `cache-` |
| 12 | Middleware | LOW-MEDIUM | `middleware-` |
| 13 | Suspense | LOW | `suspense-` |
| 14 | Prefetching | LOW | `prefetch-` |
| 15 | TypeScript | LOW | `typescript-` |

## Quick Reference

### 1. Mutations & Optimistic Updates (CRITICAL)

- `mutation-bound-prefer` — Prefer the bound `mutate` returned from `useSWR` over the global import.
- `mutation-use-swr-mutation` — Use `useSWRMutation` for POST/PATCH/DELETE; reserve `mutate` for cache writes.
- `mutation-optimistic-rollback` — Pair `optimisticData` with `rollbackOnError` for safe optimistic UI.
- `mutation-delayed-revalidation` — Delay revalidation after optimistic updates to let eventually-consistent backends catch up.
- `mutation-populate-cache` — Set `populateCache: (response, current) => ...` when the mutation response shape differs from the cache shape.
- `mutation-filter-revalidate` — Use a filter function (`mutate(key => ...)`) to revalidate many related keys in one call.
- `mutation-clear-on-logout` — Reset the entire cache with `mutate(() => true, undefined, { revalidate: false })`.
- `mutation-global-scope` — Global `mutate` only reaches hooks mounted under the same provider scope.
- `mutation-async-updater` — Pass an async updater receiving the current cache value for read-modify-write.
- `mutation-on-success` — Wire side effects through `onSuccess` / `onError` lifecycle callbacks.

### 2. Keys & Conditional Fetching (HIGH)

- `key-array-multi-arg` — Use array keys for multi-argument requests; never bake variables into the fetcher closure.
- `key-conditional-null` — Pass `null` (or a function that returns falsy) to skip a request.
- `key-stable-objects` — Object keys auto-serialize since 1.1.0; safe to pass inline objects.
- `key-dependent-fetching` — Use a function key referencing prior data for chained fetches.
- `key-per-resource-hook` — Wrap `useSWR` in a custom `useUser(id)` / `useOrders()` hook per resource.

### 3. Error Handling (HIGH)

- `error-data-coexist` — `data` and `error` can coexist; render stale data alongside error UI.
- `error-on-error-retry` — Customize `onErrorRetry` to skip non-retriable statuses and cap retries.
- `error-skip-statuses` — Don't retry 4xx (403/404/422); they won't change.
- `error-global-onerror` — Report errors from the global `onError` callback once, not per call site.
- `error-centralize-notification` — Surface errors through one shared notification primitive, not per-feature error UI.

### 4. Revalidation (HIGH)

- `revalidation-immutable` — `useSWRImmutable` for never-changing data (skips focus/reconnect/stale revalidation).
- `revalidation-disable-focus` — Disable `revalidateOnFocus` for expensive or write-sensitive endpoints.
- `revalidation-refresh-interval` — Prefer `refreshInterval` over hand-rolled `setInterval` polling.
- `revalidation-on-mount-with-fallback` — Set `revalidateOnMount: false` when you trust `fallbackData`.
- `revalidation-loading-states-vocab` — Distinguish `isLoading` (first paint), `isValidating` (any in-flight), and `isMutating` (write-in-flight).
- `revalidation-on-loading-slow` — Use `onLoadingSlow` / `loadingTimeout` for slow-network UX.
- `revalidation-is-paused` — Use `isPaused` to skip revalidation under known-bad conditions (offline, mid-edit).

### 5. Configuration (MEDIUM-HIGH)

- `config-global-swrconfig` — Set defaults via `<SWRConfig>` at the app root, not per hook.
- `config-use-swrconfig-hook` — Use `useSWRConfig()` to access scoped `mutate` and `cache`, not the imported singleton.
- `config-functional-merge` — Functional `<SWRConfig>` values don't auto-merge; spread the parent or use the object form.

### 6. Performance (MEDIUM)

- `perf-destructure-only-needed` — Destructure only the return fields you render; SWR uses dependency collection.
- `perf-deduping-interval` — Tune `dedupingInterval` per resource; default is 2000ms.
- `perf-compare-override` — Override `compare` to ignore noisy server-only fields (timestamps, request ids).

### 7. Fetchers (MEDIUM)

- `fetcher-throw-on-error` — Throw inside the fetcher to populate `error`.
- `fetcher-attach-status` — Attach `error.info` and `error.status` so consumers can branch.
- `fetcher-no-closure-vars` — Don't capture request variables in the fetcher closure; put them in the key.

### 8. Next.js Integration (MEDIUM)

- `nextjs-rsc-boundaries` — `useSWR`, `useSWRInfinite`, `useSWRMutation` all require `'use client'`.
- `nextjs-fallback-promise` — Pass server-fetched promises via `<SWRConfig fallback={...}>` and let SWR await them.

### 9. Pagination (MEDIUM)

- `pagination-keep-previous` — Set `keepPreviousData: true` to prevent flicker on indexed pagination.
- `pagination-infinite-getkey` — Return `null` from `getKey` when the previous page is empty.
- `pagination-no-hooks-in-loop` — Don't call hooks in a loop; use Page subcomponents.
- `pagination-infinite-parallel` — `parallel: true` makes `previousPageData` always `null` — change termination logic.
- `pagination-unstable-serialize` — Use `unstable_serialize` from `swr/infinite` to address infinite caches via global `mutate`.

### 10. Subscriptions (MEDIUM)

- `subscription-cleanup-fn` — Always return a cleanup function from the subscriber.
- `subscription-shared-key` — Same key shares one subscription across consumers.
- `subscription-incremental-next` — Pass a function to `next()` to accumulate updates.
- `subscription-websocket-pattern` — Canonical WebSocket-backed subscription shape.

### 11. Cache (LOW-MEDIUM)

- `cache-no-direct-write` — Never call `cache.set` directly; always go through `mutate`.
- `cache-scoped-mutate` — Use the `mutate` from `useSWRConfig()` when a custom provider is in play.
- `cache-provider-function` — `provider` must be a function returning a Map-like, not a Map instance.

### 12. Middleware (LOW-MEDIUM)

- `middleware-camelcase-name` — Name middleware in camelCase to avoid rules-of-hooks lint errors.
- `middleware-composition-order` — Composes outer-to-inner: `outerConfig → innerConfig → hook`.
- `middleware-via-use-option` — Register through the `use` array, don't wrap `useSWR` manually.

### 13. Suspense (LOW)

- `suspense-error-boundary` — Always pair `suspense: true` with both `<Suspense>` and an `<ErrorBoundary>`.
- `suspense-preload-first` — Call `preload(key, fetcher)` before rendering the suspending component.
- `suspense-stable` — `suspense` option must remain stable across renders for a given hook.

### 14. Prefetching (LOW)

- `prefetch-preload-fn` — Use `preload(key, fetcher)` on hover / route hint to avoid waterfalls.
- `prefetch-fallback-data` — Hydrate from server-rendered data via `fallbackData`.
- `prefetch-link-tag` — Use `<link rel="preload" as="fetch">` for top-level JSON guaranteed on first paint.

### 15. TypeScript (LOW)

- `typescript-generics` — Use `useSWR<Data, Error>(key, fetcher)` for explicit return / error types.
- `typescript-fetcher-type` — Use `Fetcher<Data, Key>` to type standalone fetchers.

## How to Use

Read individual rule files for the full explanation, examples, and references:

```
rules/mutation-optimistic-rollback.md
rules/key-array-multi-arg.md
rules/error-on-error-retry.md
```

Each rule contains:

- One-paragraph rationale (why it matters)
- Incorrect example with explanation
- Correct example with explanation
- Source link to the relevant SWR docs page

---
title: Don't Toggle suspense Across Renders
impact: LOW-MEDIUM
impactDescription: prevents inconsistent return-type assumptions
tags: suspense
---

## Don't Toggle suspense Across Renders

The `suspense` option must remain stable for the lifetime of a `useSWR` call. Under `suspense: true`, `data` is non-undefined (the hook throws to a boundary instead); without it, `data` can be `undefined`. Switching between modes invalidates that contract and triggers a runtime warning.

**Incorrect:**

```tsx
const { data } = useSWR(key, fetcher, { suspense: shouldUseSuspense });
// shouldUseSuspense changing across renders is unsupported
```

**Correct (pick once and keep it):**

```tsx
const { data } = useSWR(key, fetcher, { suspense: true });
```

If you really need both modes, mount a different component for each (so each `useSWR` sees a stable option).

Reference: [SWR — Suspense](https://swr.vercel.app/docs/suspense)

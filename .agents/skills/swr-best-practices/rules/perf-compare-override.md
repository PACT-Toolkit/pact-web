---
title: Override compare to Ignore Noisy Fields
impact: LOW
impactDescription: skips re-renders on cosmetic backend churn
tags: perf, compare
---

## Override compare to Ignore Noisy Fields

SWR re-renders only when the new value isn't deep-equal to the cached value. Some backends include `serverTime`, `requestId`, or rolling expiry timestamps that change on every response — those make every revalidation a "real" change. Override `compare` to strip them.

**Incorrect (every refetch re-renders):**

```tsx
const { data } = useSWR(key, fetcher);
// response shape: { items: [...], serverTime: '...' }
```

**Correct:**

```tsx
const { data } = useSWR(key, fetcher, {
  compare: (a, b) =>
    JSON.stringify({ ...a, serverTime: 0 }) ===
    JSON.stringify({ ...b, serverTime: 0 }),
});
```

Better long-term: ask the backend to drop the noisy field, or run the override in `SWRConfig` if it's pervasive.

Reference: [SWR — API Options](https://swr.vercel.app/docs/api)

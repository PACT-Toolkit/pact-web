---
title: Tune dedupingInterval Per Resource
impact: LOW-MEDIUM
impactDescription: balances freshness and load
tags: perf, dedup
---

## Tune dedupingInterval Per Resource

Default `dedupingInterval` is 2000ms — within that window, identical-key requests collapse to one network call. For frequently-rendered hooks (a header avatar, a balance widget) bumping this to 30–60s avoids redundant requests; for a critical "current price" widget you may want less.

**Incorrect (relying on default for everything):**

```tsx
const { data } = useSWR('/api/balance', fetcher);
// every component instance within 2s shares; beyond that, refetch
```

**Correct:**

```tsx
const { data } = useSWR('/api/balance', fetcher, {
  dedupingInterval: 30_000, // balance is fine for 30s
});
```

Reference: [SWR — Performance](https://swr.vercel.app/docs/advanced/performance#deduplication)

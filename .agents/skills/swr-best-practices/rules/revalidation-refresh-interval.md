---
title: Use refreshInterval Over Manual Polling
impact: MEDIUM
impactDescription: simpler, pauses when hidden
tags: revalidation, polling
---

## Use refreshInterval Over Manual Polling

Hand-rolled `setInterval` polling reimplements features SWR already gives you for free: `refreshInterval` polls only while the component is mounted, pauses when the tab is hidden (unless `refreshWhenHidden` is set), and respects `dedupingInterval`.

**Incorrect:**

```tsx
const { data, mutate } = useSWR(key, fetcher);
useEffect(() => {
  const id = setInterval(() => mutate(), 5_000);
  return () => clearInterval(id);
}, [mutate]);
```

**Correct:**

```tsx
const { data } = useSWR(key, fetcher, { refreshInterval: 5_000 });
```

For long-poll backends, prefer `useSWRSubscription` over either pattern.

Reference: [SWR — Revalidate on Interval](https://swr.vercel.app/docs/revalidation#revalidate-on-interval)

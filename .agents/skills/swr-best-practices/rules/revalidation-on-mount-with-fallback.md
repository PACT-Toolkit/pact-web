---
title: Disable revalidateOnMount When You Trust fallbackData
impact: MEDIUM
impactDescription: prevents server data being instantly overwritten
tags: revalidation, ssr, fallback
---

## Disable revalidateOnMount When You Trust fallbackData

When you've passed `fallbackData` from a server fetch (or Next.js prefetch), the default behavior still revalidates on mount and overwrites that data with a fresh client-side fetch. If the data is fresh enough already, set `revalidateOnMount: false` to skip the redundant request.

**Incorrect:**

```tsx
const { data } = useSWR(key, fetcher, { fallbackData: serverData });
// fires a network request immediately on mount, even though serverData is fresh
```

**Correct:**

```tsx
const { data } = useSWR(key, fetcher, {
  fallbackData: serverData,
  revalidateOnMount: false,
});
```

Trade-off: subsequent focus / reconnect / interval revalidations still run. Use this when you want hydration to be the source of truth for the first render only.

Reference: [SWR — Revalidate on Mount](https://swr.vercel.app/docs/revalidation#revalidate-on-mount)

---
title: Hydrate Initial Render With fallbackData
impact: LOW-MEDIUM
impactDescription: removes loading flash on first paint
tags: prefetch, ssr
---

## Hydrate Initial Render With fallbackData

For data the server already has at render time (auth user, feature flags), pass `fallbackData` so the first paint shows real content instead of a skeleton. SWR still revalidates after mount unless you also set `revalidateOnMount: false`.

**Incorrect:**

```tsx
const { data, isLoading } = useSWR('/api/user', fetcher);
if (isLoading) return <Skeleton />;
```

**Correct:**

```tsx
const { data } = useSWR('/api/user', fetcher, { fallbackData: serverUser });
// data is never undefined; no skeleton needed
```

Use `fallback` on `<SWRConfig>` instead when many hooks across the tree need hydration. See also `revalidation-on-mount-with-fallback` for skipping the post-mount refetch.

Reference: [SWR — Data Pre-filling](https://swr.vercel.app/docs/prefetching#pre-fill-data)

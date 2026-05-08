---
title: Never Write to the Cache Directly
impact: MEDIUM
impactDescription: keeps subscribers in sync
tags: cache
---

## Never Write to the Cache Directly

`cache.set(key, value)` bypasses SWR's revalidation queue and subscriber notifications — components consuming that key won't re-render. Always go through `mutate`, which writes to the cache *and* notifies subscribers.

**Incorrect:**

```tsx
const { cache } = useSWRConfig();
cache.set(key, newValue); // subscribers don't update
```

**Correct:**

```tsx
const { mutate } = useSWRConfig();
await mutate(key, newValue, { revalidate: false });
```

`cache` is exposed for read-only inspection (and for custom-provider implementations to fulfil) — not for application writes.

Reference: [SWR — Cache](https://swr.vercel.app/docs/advanced/cache)

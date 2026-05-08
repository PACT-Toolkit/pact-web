---
title: Use unstable_serialize to Address Infinite Caches Globally
impact: LOW-MEDIUM
impactDescription: enables global mutate of infinite lists
tags: pagination, mutation, infinite
---

## Use unstable_serialize to Address Infinite Caches Globally

`useSWRInfinite` stores its pages under a hashed key derived from the `getKey` function — you can't address it with the raw `getKey`. Use `unstable_serialize` from `swr/infinite` to compute the same hash and pass it to global `mutate`.

**Incorrect:**

```tsx
const getKey = (i) => `/api/items?page=${i}`;
const { data } = useSWRInfinite(getKey, fetcher);

await mutate(getKey); // doesn't match the infinite cache
```

**Correct:**

```tsx
import { unstable_serialize } from 'swr/infinite';

await mutate(unstable_serialize(getKey));
```

Note the `unstable_` prefix — the API name may change between major versions.

Reference: [SWR — Pagination](https://swr.vercel.app/docs/pagination)

---
title: Use a Filter Function to Revalidate Many Keys
impact: MEDIUM
impactDescription: targeted bulk invalidation
tags: mutation, revalidation
---

## Use a Filter Function to Revalidate Many Keys

`mutate(filterFn)` lets you invalidate every cache entry matching a predicate. This is the right primitive for "after creating an order, refresh anything starting with `/api/orders`" — far cleaner than tracking every dependent key by hand.

**Incorrect:**

```tsx
await mutate(['/api/orders']);
await mutate(['/api/orders/recent']);
await mutate(['/api/orders/summary']);
```

**Correct:**

```tsx
const { mutate } = useSWRConfig();
await mutate(
  (key) =>
    Array.isArray(key) &&
    typeof key[0] === 'string' &&
    key[0].startsWith('/api/orders'),
);
```

Always guard the predicate against the actual key shape — if the codebase uses array-tuple keys, check `Array.isArray(key)` before indexing; if it uses string keys, branch on `typeof key === 'string'`.

Reference: [SWR — Mutate Multiple Items](https://swr.vercel.app/docs/mutation#mutate-multiple-items)

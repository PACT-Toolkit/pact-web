---
title: Object Keys Are Stable Since 1.1.0
impact: MEDIUM
impactDescription: avoids redundant cache entries
tags: key, cache
---

## Object Keys Are Stable Since 1.1.0

SWR ≥ 1.1 serializes object keys with stable hashing — `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce the same cache slot. Pre-1.1 workarounds that stringified keys by hand are now obsolete and risk drifting from the auto-serializer.

**Incorrect (manual stringification):**

```tsx
const key = JSON.stringify({ url: '/api/orders', filter });
const { data } = useSWR(key, () => fetchOrders(filter));
```

**Correct (let SWR handle it):**

```tsx
const { data } = useSWR(
  { url: '/api/orders', filter },
  ({ filter }) => fetchOrders(filter),
);
```

This is also why it's safe for codegen-generated mutation hooks to accept inline POST bodies as the second tuple element — those object literals are stable across renders.

Reference: [SWR — Multiple Arguments](https://swr.vercel.app/docs/arguments#passing-objects)

---
title: Prefer the Bound mutate from useSWR
impact: HIGH
impactDescription: avoids key drift, scoped to provider
tags: mutation, cache
---

## Prefer the Bound mutate from useSWR

`useSWR` returns a `mutate` already bound to the hook's key and provider. The imported global `mutate` requires you to repeat the key and only updates hooks under the default provider scope.

**Incorrect:**

```tsx
import { mutate } from 'swr';

const { data } = useSWR('/api/user', fetcher);
const refresh = () => mutate('/api/user'); // duplicated key
```

**Correct:**

```tsx
const { data, mutate: refreshUser } = useSWR('/api/user', fetcher);
const refresh = () => refreshUser();
```

Use the global `mutate` only when you need to invalidate a key from a component that doesn't own the hook (e.g. a sibling component triggering revalidation across features) — and prefer `useSWRConfig()` over the imported singleton in that case.

Reference: [SWR — Mutation](https://swr.vercel.app/docs/mutation)

---
title: Global mutate Only Reaches the Default Provider
impact: MEDIUM
impactDescription: prevents silent no-op invalidations
tags: mutation, cache, provider
---

## Global mutate Only Reaches the Default Provider

The `mutate` exported from `'swr'` is bound to the default provider. Hooks rendered inside a nested `<SWRConfig provider={...}>` are isolated — global `mutate` calls won't reach them. Always use `useSWRConfig().mutate` when a custom provider may be in play (tests, isolated subtrees, persisted caches).

**Incorrect:**

```tsx
import { mutate } from 'swr';

// inside a subtree wrapped with a custom provider
const refresh = () => mutate('/api/user'); // no-op
```

**Correct:**

```tsx
const { mutate } = useSWRConfig();
const refresh = () => mutate('/api/user');
```

Reference: [SWR — Cache Provider](https://swr.vercel.app/docs/advanced/cache)

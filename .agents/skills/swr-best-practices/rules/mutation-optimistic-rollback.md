---
title: Pair optimisticData with rollbackOnError
impact: HIGH
impactDescription: safe optimistic UI
tags: mutation, optimistic
---

## Pair optimisticData with rollbackOnError

`optimisticData` updates the cache before the request resolves; `rollbackOnError: true` (the default) reverts that optimistic value if the request throws. Setting `optimisticData` without ensuring rollback leaves the UI permanently desynced from the backend on failure.

**Incorrect:**

```tsx
mutate(key, updateUser(values), {
  optimisticData: { ...user, name: values.name },
  rollbackOnError: false, // user sees a stale "successful" UI on failure
});
```

**Correct:**

```tsx
mutate(key, updateUser(values), {
  optimisticData: (current) => ({ ...current, name: values.name }),
  rollbackOnError: true,
  revalidate: false,
});
```

Pass a function to `optimisticData` when the new value depends on the current cache — it receives the current value and avoids stale closures.

Reference: [SWR — Optimistic UI](https://swr.vercel.app/docs/mutation#optimistic-updates)

---
title: Pass an Async Function to mutate for Read-Modify-Write
impact: MEDIUM
impactDescription: avoids stale closures, allows async transforms
tags: mutation
---

## Pass an Async Function to mutate for Read-Modify-Write

`mutate(key, asyncFn)` accepts an async updater that receives the current cache value and returns the new one. This is the right primitive for "fetch the new value, then patch it on top of the current cache" — better than reading from cache, computing, and passing a literal value (which can race).

**Incorrect (reads cache before any concurrent mutation lands):**

```tsx
const current = cache.get(key);
const next = await fetchAndPatch(current);
mutate(key, next, { revalidate: false });
```

**Correct:**

```tsx
mutate(
  key,
  async (current) => {
    const patched = await fetchAndPatch(current);
    return patched;
  },
  { revalidate: false },
);
```

Reference: [SWR — Mutation](https://swr.vercel.app/docs/mutation)

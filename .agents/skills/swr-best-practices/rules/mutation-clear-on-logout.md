---
title: Clear the Entire Cache on Logout
impact: MEDIUM
impactDescription: prevents stale data leaking across sessions
tags: mutation, cache, security
---

## Clear the Entire Cache on Logout

After logout, every cached response belongs to a now-unauthenticated user. Wipe the cache without revalidating (which would otherwise immediately re-fetch with no auth and pollute the cache with errors).

**Incorrect:**

```tsx
const onLogout = async () => {
  await logout();
  // cache still holds the previous user's data
};
```

**Correct:**

```tsx
const { mutate } = useSWRConfig();

const onLogout = async () => {
  await logout();
  await mutate(() => true, undefined, { revalidate: false });
};
```

The pattern is `mutate(filter, undefined, { revalidate: false })`: `() => true` matches every key, `undefined` clears the value, `revalidate: false` prevents the immediate refetch.

Reference: [SWR — Mutate Multiple Items](https://swr.vercel.app/docs/mutation#mutate-multiple-items)

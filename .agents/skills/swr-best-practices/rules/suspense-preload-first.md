---
title: Preload Before Rendering Suspending Components
impact: LOW-MEDIUM
impactDescription: avoids waterfall
tags: suspense, prefetch
---

## Preload Before Rendering Suspending Components

The classic SWR + Suspense waterfall: a parent suspends on its own data, and only after it resolves do its children mount and start their own fetches. Calling `preload(key, fetcher)` *before* the suspending tree mounts (on hover, on route entry, in a route loader) starts every fetch in parallel — by the time the components render, their data is already in flight or in cache.

**Incorrect (parent → child waterfall):**

```tsx
function ProfilePage() {
  const { data: user } = useSWR('/api/user', fetcher, { suspense: true });
  return <UserProjects userId={user.id} />;
  // UserProjects doesn't start fetching until /api/user resolves
}
```

**Correct (preload kicks off both fetches before render):**

```tsx
function navigateToProfile(userId) {
  preload('/api/user', fetcher);
  preload(['/api/projects', userId], projectsFetcher);
  router.push('/profile');
}
```

Sibling components inside the same `<Suspense>` boundary already render in parallel under React 18+ — the waterfall this rule targets is the parent-fetches-then-renders-child pattern.

Reference: [SWR — Prefetching](https://swr.vercel.app/docs/prefetching)

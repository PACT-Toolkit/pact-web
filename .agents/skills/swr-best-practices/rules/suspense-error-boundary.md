---
title: Pair suspense With an Error Boundary
impact: MEDIUM
impactDescription: prevents crashes on fetch failure
tags: suspense, error
---

## Pair suspense With an Error Boundary

With `suspense: true`, SWR throws on error to the nearest error boundary instead of populating `error`. Without one, the unhandled throw escapes to the root and crashes the app.

**Incorrect:**

```tsx
<Suspense fallback={<Skeleton />}>
  <UserCard />
</Suspense>;
// no boundary; thrown errors crash the tree
```

**Correct:**

```tsx
<ErrorBoundary fallback={<ErrorState />}>
  <Suspense fallback={<Skeleton />}>
    <UserCard />
  </Suspense>
</ErrorBoundary>;
```

Also: `suspense` may not toggle across renders for the same hook — pick at mount and keep it stable.

Reference: [SWR — Suspense](https://swr.vercel.app/docs/suspense)

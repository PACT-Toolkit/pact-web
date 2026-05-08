---
title: Use keepPreviousData to Prevent Pagination Flicker
impact: MEDIUM
impactDescription: smoother pagination UX
tags: pagination, ux
---

## Use keepPreviousData to Prevent Pagination Flicker

By default, when the key changes (page → page+1), SWR clears `data` to `undefined` until the next response arrives. The list flickers to a skeleton between every page click. `keepPreviousData: true` keeps the last page rendered until the next loads.

**Incorrect:**

```tsx
const { data } = useSWR(['/api/items', page], fetcher);
return data ? <List items={data} /> : <Skeleton />;
// flickers on every page change
```

**Correct:**

```tsx
const { data, isLoading } = useSWR(['/api/items', page], fetcher, {
  keepPreviousData: true,
});
return (
  <div style={{ opacity: isLoading ? 0.6 : 1 }}>
    {data ? <List items={data} /> : <Skeleton />}
  </div>
);
```

Reference: [SWR — Pagination](https://swr.vercel.app/docs/pagination)

---
title: Don't Call SWR Hooks in a Loop
impact: HIGH
impactDescription: rules of hooks
tags: pagination, hooks
---

## Don't Call SWR Hooks in a Loop

For "preload N pages" patterns, calling `useSWR` inside a loop violates the rules of hooks (the count must be stable across renders). Render a Page subcomponent for each page instead — each Page calls `useSWR` exactly once.

**Incorrect:**

```tsx
function Pages({ count }) {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const { data } = useSWR(['/api/items', i], fetcher); // crash
    pages.push(data);
  }
}
```

**Correct:**

```tsx
function Page({ index }) {
  const { data } = useSWR(['/api/items', index], fetcher);
  return <List items={data} />;
}

function Pages({ count }) {
  return Array.from({ length: count }, (_, i) => <Page key={i} index={i} />);
}
```

Reference: [SWR — Pagination](https://swr.vercel.app/docs/pagination)

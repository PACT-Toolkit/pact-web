---
title: Destructure Only the Fields You Render
impact: MEDIUM
impactDescription: skips re-renders on irrelevant state changes
tags: perf, dependency-collection
---

## Destructure Only the Fields You Render

SWR uses dependency collection: it only re-renders the component when a destructured field changes. If you destructure `isValidating` but never render anything based on it, every background revalidation triggers a re-render for nothing.

**Incorrect:**

```tsx
const { data, isValidating } = useSWR(key, fetcher);
return <Table rows={data} />; // re-renders on every focus, no UI change
```

**Correct:**

```tsx
const { data } = useSWR(key, fetcher);
return <Table rows={data} />;
```

Reference: [SWR — Performance](https://swr.vercel.app/docs/advanced/performance#dependency-collection)

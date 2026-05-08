---
title: Return null From getKey at the End of an Infinite List
impact: MEDIUM
impactDescription: stops infinite loading at the right point
tags: pagination, infinite
---

## Return null From getKey at the End of an Infinite List

`useSWRInfinite`'s `getKey` is called with `(pageIndex, previousPageData)`. Returning `null` signals "no more pages" and stops `setSize` from fetching further. Returning a key for an out-of-range page produces empty results indefinitely.

**Incorrect:**

```tsx
const getKey = (pageIndex) => `/api/items?page=${pageIndex}`;
// setSize keeps fetching past the last real page
```

**Correct:**

```tsx
const getKey = (pageIndex, previousPageData) => {
  if (previousPageData && previousPageData.length === 0) return null;
  return `/api/items?page=${pageIndex}`;
};

const { data, size, setSize } = useSWRInfinite(getKey, fetcher);
```

Note: `previousPageData` is `null` when `parallel: true` — terminate via response-length checks based on the current page's expected size in that mode.

Reference: [SWR — useSWRInfinite](https://swr.vercel.app/docs/pagination#useswrinfinite)

---
title: parallel: true Makes previousPageData null
impact: MEDIUM
impactDescription: termination logic must change
tags: pagination, infinite
---

## parallel: true Makes previousPageData null

`useSWRInfinite` fetches sequentially by default — each page can read the previous page's data inside `getKey`. Setting `parallel: true` fans out all pages at once, but `previousPageData` is `null` for every call — the "stop when previous page is empty" idiom breaks silently.

**Incorrect (parallel mode + previousPageData check):**

```tsx
const { data } = useSWRInfinite(
  (i, prev) => (prev && !prev.length ? null : `/api/items?page=${i}`),
  fetcher,
  { parallel: true }, // prev is always null — never stops
);
```

**Correct (terminate via known total or page-size response):**

```tsx
const { data: meta } = useSWR('/api/items/meta', fetcher);
const totalPages = meta?.totalPages ?? 1;
const { data } = useSWRInfinite(
  (i) => (i >= totalPages ? null : `/api/items?page=${i}`),
  fetcher,
  { parallel: true },
);
```

Reference: [SWR — Pagination](https://swr.vercel.app/docs/pagination)

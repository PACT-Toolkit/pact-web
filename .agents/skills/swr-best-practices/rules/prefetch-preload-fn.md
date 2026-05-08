---
title: Use preload() on Hover or Route Hint
impact: LOW-MEDIUM
impactDescription: shaves latency off perceived navigation
tags: prefetch, ux
---

## Use preload() on Hover or Route Hint

`preload(key, fetcher)` warms the cache from anywhere — event handlers, router hooks, even outside React. Calling it on hover for a likely-next page makes the navigation feel instant when the user actually clicks.

**Incorrect (cold load on click):**

```tsx
<Link href={`/users/${id}`}>View</Link>;
// fetch only starts after click
```

**Correct:**

```tsx
import { preload } from 'swr';

<Link
  href={`/users/${id}`}
  onMouseEnter={() => preload(['/api/user', id], userFetcher)}
>
  View
</Link>;
```

Reference: [SWR — Prefetching with preload](https://swr.vercel.app/docs/prefetching#programmatically-prefetch)

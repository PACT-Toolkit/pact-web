---
title: Use <link rel="preload"> for Top-Level JSON
impact: LOW
impactDescription: shaves request RTT off first paint
tags: prefetch, html
---

## Use `<link rel="preload">` for Top-Level JSON

For data the page is guaranteed to need on first paint, an HTML `<link rel="preload" as="fetch">` tag in `<head>` starts the request before the JS bundle parses. By the time `useSWR` runs, the response is in the browser's HTTP cache and resolves without a fresh round-trip.

```html
<head>
  <link
    rel="preload"
    href="/api/me"
    as="fetch"
    crossorigin="anonymous"
  />
</head>
```

```tsx
// Later, when the React tree mounts:
const { data } = useSWR('/api/me', fetcher);
// fetcher hits the browser cache, no extra RTT
```

The `crossorigin` attribute must match how `fetch` is called (with or without credentials) — a mismatch causes the browser to discard the preload and re-issue the request.

Reference: [SWR — Prefetching](https://swr.vercel.app/docs/prefetching)

---
title: Use onLoadingSlow for Slow-Network UX
impact: LOW-MEDIUM
impactDescription: surfaces a "still loading" state at the right moment
tags: revalidation, ux, loading
---

## Use onLoadingSlow for Slow-Network UX

`onLoadingSlow` fires when a request hasn't resolved within `loadingTimeout` (default 3000ms). It's the right hook for "we're still working on it" UX — show a more descriptive spinner, log a slow-fetch metric, or kick off a fallback strategy.

```tsx
const { data } = useSWR(key, fetcher, {
  loadingTimeout: 3000,
  onLoadingSlow: (key) => {
    metrics.increment('swr.slow', { key });
    setShowExtendedSpinner(true);
  },
});
```

This fires *once per request* — not continuously while the request is slow — so it's safe to trigger UI changes from it without throttling.

Reference: [SWR — API Options](https://swr.vercel.app/docs/api)

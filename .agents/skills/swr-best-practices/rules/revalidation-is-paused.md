---
title: Use isPaused to Skip Revalidation Conditionally
impact: LOW-MEDIUM
impactDescription: avoids requests under known-bad conditions
tags: revalidation, conditional
---

## Use isPaused to Skip Revalidation Conditionally

`isPaused` is a function called before every revalidation — return `true` to skip. It's stricter than `key: null` (which prevents the hook from running at all) — `isPaused` keeps the cached data visible but pauses background work.

Useful for: pausing while the user is mid-edit, while an app is backgrounded, while offline, or during a maintenance window.

```tsx
const isOffline = useNetworkStatus();
const { data } = useSWR(key, fetcher, {
  isPaused: () => isOffline,
});
// data stays visible; no focus / interval / reconnect refetches while offline
```

Compared to `revalidateOnFocus: false`, `isPaused` is dynamic — it can flip on/off across renders without restructuring the hook.

Reference: [SWR — API Options](https://swr.vercel.app/docs/api)

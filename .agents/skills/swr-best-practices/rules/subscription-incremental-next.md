---
title: Pass a Function to next() for Incremental Updates
impact: MEDIUM
impactDescription: keeps a running state without external refs
tags: subscription, state
---

## Pass a Function to next() for Incremental Updates

`next(error, data)` accepts a function for `data` — it receives the previous value and returns the next. Use this for streams that should accumulate (chat messages, log lines) rather than replace.

**Incorrect (loses prior messages):**

```tsx
useSWRSubscription(url, (key, { next }) => {
  const socket = new WebSocket(key);
  socket.onmessage = (e) => next(null, [JSON.parse(e.data)]); // overwrites
  return () => socket.close();
});
```

**Correct:**

```tsx
useSWRSubscription(url, (key, { next }) => {
  const socket = new WebSocket(key);
  socket.onmessage = (e) =>
    next(null, (prev = []) => [...prev, JSON.parse(e.data)]);
  return () => socket.close();
});
```

Reference: [SWR — Subscription](https://swr.vercel.app/docs/subscription)

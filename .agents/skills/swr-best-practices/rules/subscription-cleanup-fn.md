---
title: Always Return a Cleanup Function from useSWRSubscription
impact: HIGH
impactDescription: prevents memory leaks
tags: subscription
---

## Always Return a Cleanup Function from useSWRSubscription

The subscriber callback passed to `useSWRSubscription` must return a cleanup function. SWR calls it when the last consumer unmounts (or the key changes). Forgetting the return leaves sockets, intervals, or listeners running indefinitely.

**Incorrect:**

```tsx
useSWRSubscription(url, (key, { next }) => {
  const socket = new WebSocket(key);
  socket.addEventListener('message', (e) => next(null, e.data));
  // no cleanup — socket lives forever
});
```

**Correct:**

```tsx
useSWRSubscription(url, (key, { next }) => {
  const socket = new WebSocket(key);
  socket.addEventListener('message', (e) => next(null, e.data));
  socket.addEventListener('error', (e) => next(e));
  return () => socket.close();
});
```

Reference: [SWR — Subscription](https://swr.vercel.app/docs/subscription)

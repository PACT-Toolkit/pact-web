---
title: Same Key Shares a Single Subscription
impact: MEDIUM
impactDescription: prevents duplicate connections
tags: subscription, dedup
---

## Same Key Shares a Single Subscription

`useSWRSubscription` dedupes by key the same way `useSWR` does. Multiple components subscribing to the same key share one underlying connection — the subscriber function runs once, and SWR closes it when the last consumer unmounts. Don't try to share connections by hand.

**Incorrect (manually managing a singleton socket):**

```tsx
let socket: WebSocket | null = null;
function useStream(url) {
  useEffect(() => {
    socket ??= new WebSocket(url);
    // ...complex refcount logic
  }, [url]);
}
```

**Correct:**

```tsx
function useStream(url) {
  return useSWRSubscription(url, (key, { next }) => {
    const socket = new WebSocket(key);
    socket.addEventListener('message', (e) => next(null, e.data));
    return () => socket.close();
  });
}
// Multiple components can call useStream(url) — one socket
```

Reference: [SWR — Subscription](https://swr.vercel.app/docs/subscription)

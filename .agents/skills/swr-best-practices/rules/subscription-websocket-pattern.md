---
title: Canonical WebSocket Subscription Pattern
impact: LOW
impactDescription: reference pattern
tags: subscription, websocket
---

## Canonical WebSocket Subscription Pattern

The shape of a typical WebSocket-backed subscription: open the connection, forward `message` to `next(null, ...)`, forward `error` to `next(error)`, return a cleanup that closes the socket. SWR auto-clears the error when fresh data arrives.

```tsx
function useTickerStream(symbol: string) {
  return useSWRSubscription<Tick, Error>(
    `wss://example.com/ticks/${symbol}`,
    (key, { next }) => {
      const socket = new WebSocket(key);
      socket.addEventListener('message', (event) => {
        next(null, JSON.parse(event.data) as Tick);
      });
      socket.addEventListener('error', (event) => {
        next(new Error('Stream failed'));
      });
      return () => socket.close();
    },
  );
}
```

The same shape works for EventSource, Firebase listeners, or any push-based source — the only thing that changes is which API maps to `next` and which API the cleanup calls.

Reference: [SWR — Subscription](https://swr.vercel.app/docs/subscription)

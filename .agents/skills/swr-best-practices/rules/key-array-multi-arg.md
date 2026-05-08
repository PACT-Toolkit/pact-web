---
title: Use Array Keys for Multi-Argument Requests
impact: HIGH
impactDescription: cache correctness
tags: key, cache
---

## Use Array Keys for Multi-Argument Requests

When a request depends on multiple values (id, token, filter), put them all in the key. Variables baked into the fetcher closure are invisible to SWR's cache — different values produce the same cache hit and stale data leaks across users / contexts.

**Incorrect (token captured in closure):**

```tsx
const fetchUser = () => fetch('/api/user', { headers: { auth: token } });
const { data } = useSWR('/api/user', fetchUser); // wrong user after token change
```

**Correct (token is part of the key):**

```tsx
const { data } = useSWR(
  ['/api/user', token],
  ([url, t]) => fetch(url, { headers: { auth: t } }).then((r) => r.json()),
);
```

Since SWR 2.0 the array is passed as a single argument — destructure it. The whole array participates in the cache key, so changing any element produces a fresh request.

Reference: [SWR — Multiple Arguments](https://swr.vercel.app/docs/arguments)

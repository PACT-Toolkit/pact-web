---
title: Pass null to Skip a Request
impact: HIGH
impactDescription: avoids invalid fetches
tags: key, conditional
---

## Pass null to Skip a Request

The idiomatic way to gate a request is to pass `null` as the key (or a function that throws / returns falsy). Wrapping `useSWR` in a conditional `if` violates the rules of hooks; using a placeholder string fires unwanted requests.

**Incorrect:**

```tsx
const { data } = useSWR(
  userId ? `/api/user/${userId}` : '/api/empty', // fires a real request
  fetcher,
);
```

**Correct:**

```tsx
const { data } = useSWR(userId ? `/api/user/${userId}` : null, fetcher);
```

A `null` key keeps `useSWR` mounted (so the slot in the rules of hooks is preserved) but skips the network request entirely. `data` is `undefined` and `isLoading` is `false`.

Reference: [SWR — Conditional Fetching](https://swr.vercel.app/docs/conditional-fetching)

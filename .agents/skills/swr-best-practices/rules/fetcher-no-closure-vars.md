---
title: Don't Capture Request Variables in the Fetcher Closure
impact: HIGH
impactDescription: prevents stale-data bugs
tags: fetcher, key
---

## Don't Capture Request Variables in the Fetcher Closure

Variables captured inside the fetcher are invisible to the cache key. Two requests with the same key but different captured values resolve to the same cache slot — and SWR will never know the second call needs its own data.

**Incorrect:**

```tsx
function useTodos(filter) {
  return useSWR('/api/todos', () => fetchTodos(filter));
  // changing `filter` returns the cached value for the previous filter
}
```

**Correct:**

```tsx
function useTodos(filter) {
  return useSWR(['/api/todos', filter], ([, f]) => fetchTodos(f));
}
```

Reference: [SWR — Multiple Arguments](https://swr.vercel.app/docs/arguments#multiple-arguments)

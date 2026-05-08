---
title: Use populateCache When Response Shape Differs
impact: MEDIUM
impactDescription: avoids cache corruption
tags: mutation, cache
---

## Use populateCache When Response Shape Differs

By default, `mutate` puts the resolved value of the updater into the cache as-is. If the mutation response shape (e.g. `{ data, meta }`) doesn't match the query shape (e.g. an array), the cache is silently corrupted. `populateCache` lets you transform the response before it lands.

**Incorrect:**

```tsx
mutate(key, addItem(item), { revalidate: false });
// cache becomes { item: ... } even though useSWR returns Item[]
```

**Correct:**

```tsx
mutate(key, addItem(item), {
  populateCache: (response, current) => [...current, response.item],
  revalidate: false,
});
```

Note: `populateCache` defaults to `true` for `mutate` and `false` for `useSWRMutation` — set it explicitly on `useSWRMutation` if you want the response written into the query cache.

Reference: [SWR — populateCache](https://swr.vercel.app/docs/mutation#useswrmutation)

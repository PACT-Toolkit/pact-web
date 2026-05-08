---
title: Use useSWRMutation for Remote Writes
impact: HIGH
impactDescription: race-safe, isolated, no auto-trigger
tags: mutation
---

## Use useSWRMutation for Remote Writes

`useSWRMutation` is purpose-built for POST/PATCH/DELETE: it doesn't fire on mount, exposes `trigger()` and `isMutating`, and cancels stale concurrent `useSWR` requests for the same key. Using `mutate(key, fetcher())` for writes conflates "update server" with "update cache" and surfaces the wrong loading state.

**Incorrect:**

```tsx
const onSubmit = async (values) => {
  await mutate('/api/user', updateUser(values), { revalidate: false });
};
```

**Correct:**

```tsx
const { trigger, isMutating } = useSWRMutation('/api/user', (key, { arg }) =>
  updateUser(arg),
);

const onSubmit = (values) => trigger(values);
```

Reference: [SWR — useSWRMutation](https://swr.vercel.app/docs/mutation#useswrmutation)

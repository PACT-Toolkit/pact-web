---
title: Delay Revalidation After Optimistic Updates
impact: HIGH
impactDescription: prevents thrash, respects backend write delay
tags: mutation, revalidation, optimistic
---

## Delay Revalidation After Optimistic Updates

Backends are often eventually consistent — calling `mutate(key)` immediately after a successful write frequently refetches a stale value and overwrites the optimistic UI. Delay the revalidation by a few seconds (or trigger it from a server-sent event) so the read-after-write actually sees the new value.

A small `useDelayedRevalidation` helper that debounces revalidation and survives unmount is the right shape, so a successful mutation followed by navigation still triggers the eventual sync.

**Incorrect (immediate revalidation races the backend):**

```tsx
const { trigger } = useUpdateUser();
const onSubmit = async (values) => {
  await trigger(values);
  await mutate(userKey); // refetches before the write has landed
};
```

**Correct (optimistic patch + delayed revalidation):**

```tsx
const scheduleRevalidation = useDelayedRevalidation(userKey, { delay: 2500 });
const { trigger } = useUpdateUser();

const onSubmit = async (values) => {
  await mutate(userKey, (current) => ({ ...current, ...values }), {
    revalidate: false,
  });
  await trigger(values);
  scheduleRevalidation();
};
```

Reference: [SWR — Optimistic UI](https://swr.vercel.app/docs/mutation#optimistic-updates)

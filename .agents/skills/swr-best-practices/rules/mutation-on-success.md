---
title: Handle Mutation Lifecycle With onSuccess / onError
impact: MEDIUM
impactDescription: keeps side effects out of awaited code
tags: mutation, lifecycle
---

## Handle Mutation Lifecycle With onSuccess / onError

`useSWRMutation` accepts lifecycle callbacks (`onSuccess`, `onError`) on its options object. They run after the mutation completes and are the cleanest place to wire side effects: closing dialogs, navigating, queuing follow-up revalidations. Stuffing all of that into the awaited code path mixes flow control with side effects and is harder to test.

**Incorrect (everything in one imperative block):**

```tsx
const { trigger } = useSWRMutation('/api/user', updateUser);

const onSubmit = async (values) => {
  try {
    await trigger(values);
    closeDialog();
    navigate('/profile');
    toast.success('Saved');
  } catch (e) {
    toast.error(e);
  }
};
```

**Correct:**

```tsx
const { trigger } = useSWRMutation('/api/user', updateUser, {
  onSuccess: () => {
    closeDialog();
    navigate('/profile');
    toast.success('Saved');
  },
  onError: (error) => toast.error(error),
});

const onSubmit = (values) => trigger(values);
```

`useSWR` exposes a parallel `onSuccess` and `onDiscarded` (the latter fires when a stale result is dropped because a newer request superseded it) — same idea applies for query-side side effects.

Reference: [SWR — API Options](https://swr.vercel.app/docs/api)

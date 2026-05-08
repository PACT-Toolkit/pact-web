---
title: Centralize Error Notification
impact: MEDIUM
impactDescription: consistent error UX
tags: error, ux
---

## Centralize Error Notification

Surface SWR errors through one shared notification primitive (a toast helper, a notify hook, an error boundary) rather than per-feature error components. The shared helper can unpack transport-specific errors (`AxiosError`, `FetchError`) once, surface a server-provided error message, and fall back to a generic copy. Hand-rolling per-feature error UI fragments wording and behavior across the app.

**Incorrect:**

```tsx
const { error } = useGetUser();
if (error) return <Text>Something went wrong: {error.message}</Text>;
```

**Correct (catch + notify at the call site):**

```tsx
const notify = useNotify();
const { trigger } = useUpdateUser();

const onSubmit = async (values) => {
  try {
    await trigger(values);
  } catch (error) {
    notify.error(error);
  }
};
```

For query hooks (read failures), prefer rendering an inline error component rather than a toast — toasts are for transient feedback, not persistent failure states.

Reference: [SWR — Global Error Report](https://swr.vercel.app/docs/error-handling#global-error-report)

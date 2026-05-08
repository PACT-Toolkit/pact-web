---
title: Report Errors Once via Global onError
impact: MEDIUM
impactDescription: avoids duplicate telemetry
tags: error, telemetry
---

## Report Errors Once via Global onError

`onError` on `<SWRConfig>` fires for every hook's failure. Reporting from there keeps telemetry consistent and avoids per-call-site duplication. Filter out noisy statuses (401 if the auth interceptor already handles it, 404 for resource-existence checks).

**Incorrect (per-hook reporting):**

```tsx
const { data } = useSWR(key, fetcher, {
  onError: (err) => Sentry.captureException(err),
});
```

**Correct:**

```tsx
<SWRConfig
  value={{
    onError: (error) => {
      const status = error.response?.status; // Axios error shape
      if (status === 401 || status === 404) return;
      Sentry.captureException(error);
    },
  }}
>
  {children}
</SWRConfig>
```

Reference: [SWR — Global Error Report](https://swr.vercel.app/docs/error-handling#global-error-report)

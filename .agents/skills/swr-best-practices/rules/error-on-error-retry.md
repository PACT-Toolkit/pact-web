---
title: Customize onErrorRetry for Status-Aware Backoff
impact: HIGH
impactDescription: avoids hammering broken endpoints
tags: error, retry
---

## Customize onErrorRetry for Status-Aware Backoff

SWR retries with exponential backoff by default, capped by `errorRetryCount`. For HTTP APIs, status-aware retry is much better: skip 4xx, refresh-then-retry on 401, respect `Retry-After` for 429 / 408. Centralize this in your global `<SWRConfig>` once, instead of reaching for `shouldRetryOnError: false` at call sites.

**Incorrect (per-call site override):**

```tsx
const { data } = useSWR(key, fetcher, { shouldRetryOnError: false });
```

**Correct (centralized in SWRConfig):**

```tsx
<SWRConfig
  value={{
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      const status = error.response?.status; // Axios error shape
      if ([400, 403, 404, 409, 422].includes(status)) return;
      if (status === 401 && retryCount >= 2) return;
      const retryAfter = parseRetryAfter(error.response?.headers);
      const delay = retryAfter ?? Math.min(1000 * 2 ** retryCount, 30_000);
      setTimeout(() => revalidate({ retryCount }), delay);
    },
  }}
>
  {children}
</SWRConfig>
```

Reference: [SWR — Error Retry](https://swr.vercel.app/docs/error-handling#error-retry)

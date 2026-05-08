---
title: Don't Retry 4xx Statuses
impact: MEDIUM
impactDescription: latency, server load
tags: error, retry
---

## Don't Retry 4xx Statuses

`403`, `404`, `409`, `422` are deterministic responses — retrying won't change the outcome and just adds latency for the user and load for the backend. The only reasonable 4xx to retry is `401` (after a token refresh) and `429` / `408` (with backoff that honors `Retry-After`).

**Incorrect (retries every status, including 404):**

```ts
onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
  if (retryCount >= 5) return;
  setTimeout(() => revalidate({ retryCount }), 5_000);
};
```

**Correct (return early for non-retriable statuses):**

```ts
onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
  const status = error.response?.status; // Axios error shape
  if ([400, 403, 404, 409, 422].includes(status)) return;
  if (retryCount >= 5) return;
  setTimeout(() => revalidate({ retryCount }), 5_000);
};
```

Reference: [SWR — Error Retry](https://swr.vercel.app/docs/error-handling#error-retry)

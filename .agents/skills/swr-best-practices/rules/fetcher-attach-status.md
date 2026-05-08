---
title: Attach status and info to Thrown Errors
impact: MEDIUM
impactDescription: enables status-aware retry and UI
tags: fetcher, error
---

## Attach status and info to Thrown Errors

Every consumer of an SWR error needs at least `status` (to branch UI / retry) and the response body (to surface a server-provided error message). Centralize this in the fetcher so call sites don't reach into transport-specific shapes.

**Incorrect (status only available via raw response):**

```ts
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('failed');
  return res.json();
};
```

**Correct:**

```ts
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error: any = new Error('Request failed');
    error.status = res.status;
    error.info = await res.json().catch(() => null);
    throw error;
  }
  return res.json();
};
```

For Axios, the `AxiosError` already exposes `error.response.status` and `error.response.data` — the same branching works without a custom fetcher.

Reference: [SWR — Error Handling](https://swr.vercel.app/docs/error-handling)

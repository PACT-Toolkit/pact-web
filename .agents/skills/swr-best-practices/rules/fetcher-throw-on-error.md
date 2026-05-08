---
title: Throw From the Fetcher to Populate error
impact: HIGH
impactDescription: makes failures visible to SWR
tags: fetcher, error
---

## Throw From the Fetcher to Populate error

SWR populates `error` only when the fetcher throws. Returning `null` or an error object on a non-2xx response leaves `error` empty and `data` set to that error shape — every consumer then has to re-derive "did this fail?" from the data.

**Incorrect:**

```ts
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  return res.json();
};
```

**Correct:**

```ts
const fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error: any = new Error('Request failed');
    error.info = await res.json().catch(() => null);
    error.status = res.status;
    throw error;
  }
  return res.json();
};
```

Axios already throws on non-2xx by default — codegen tools that wrap Axios (Orval, openapi-typescript-codegen) inherit this behavior for free.

Reference: [SWR — Status Code and Error Object](https://swr.vercel.app/docs/error-handling#status-code-and-error-object)

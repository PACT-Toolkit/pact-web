---
title: data and error Can Coexist
impact: MEDIUM
impactDescription: avoids flicker on background refresh failures
tags: error, ux
---

## data and error Can Coexist

SWR keeps the last successful `data` even after a revalidation fails — `error` is set but `data` still holds the previous value. This is the right model for stale-while-revalidate: show the cached UI plus a subtle "couldn't refresh" indicator.

**Incorrect (treats error as a hard failure, hides good data):**

```tsx
const { data, error } = useSWR(key, fetcher);
if (error) return <ErrorState />;
return <Table rows={data} />;
```

**Correct:**

```tsx
const { data, error } = useSWR(key, fetcher);
if (!data && error) return <ErrorState />;
return (
  <>
    {error && <RefreshFailedBanner />}
    {data && <Table rows={data} />}
  </>
);
```

Reference: [SWR — Error Handling](https://swr.vercel.app/docs/error-handling)

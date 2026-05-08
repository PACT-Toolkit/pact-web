---
title: Pass Middleware via the use Option
impact: LOW
impactDescription: idiomatic registration
tags: middleware
---

## Pass Middleware via the use Option

Middleware is registered through the `use` array — either globally on `<SWRConfig>` or per-hook. Don't try to wrap `useSWR` itself — middleware exists precisely so you don't have to.

**Incorrect (manual wrapping):**

```tsx
function useLoggingSWR(key, fetcher, config) {
  console.log('SWR call', key);
  return useSWR(key, fetcher, config);
}
```

**Correct (middleware):**

```tsx
const logger = (useSWRNext) => (key, fetcher, config) => {
  console.log('SWR call', key);
  return useSWRNext(key, fetcher, config);
};

<SWRConfig value={{ use: [logger] }}>{children}</SWRConfig>;
```

Reference: [SWR — Middleware](https://swr.vercel.app/docs/middleware)

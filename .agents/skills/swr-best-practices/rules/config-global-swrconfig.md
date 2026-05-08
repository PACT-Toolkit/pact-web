---
title: Set Defaults Through Global SWRConfig
impact: MEDIUM
impactDescription: avoids per-hook drift
tags: config
---

## Set Defaults Through Global SWRConfig

Anything that should apply to most hooks (`onErrorRetry`, `onError`, `dedupingInterval`, `provider`) belongs in `<SWRConfig>` at the app root. Per-hook overrides are for specific exceptions, not defaults.

**Incorrect (each hook re-declares the same options):**

```tsx
useSWR(key, fetcher, { onErrorRetry: customRetry });
useSWR(otherKey, fetcher, { onErrorRetry: customRetry });
```

**Correct:**

```tsx
<SWRConfig value={{ onErrorRetry: customRetry }}>{children}</SWRConfig>
```

Note that primitive options replace on nested `<SWRConfig>`, but mergeable objects like `fallback` merge — read the docs before nesting providers if you rely on inheritance.

Reference: [SWR — Global Configuration](https://swr.vercel.app/docs/global-configuration), `src/framework/network/swr/SWRProvider.tsx`

---
title: Functional SWRConfig Values Don't Auto-Merge
impact: MEDIUM
impactDescription: prevents silently dropped parent options
tags: config
---

## Functional SWRConfig Values Don't Auto-Merge

`<SWRConfig value={...}>` accepts either an object (which merges with the parent config) or a function (which receives the parent config and returns the new one). With the function form, only the keys you return are kept — keys you don't return are *dropped*, not inherited from the parent.

**Incorrect (parent's `onErrorRetry` is silently lost):**

```tsx
<SWRConfig value={() => ({ refreshInterval: 5_000 })}>
  {/* onErrorRetry, fetcher, etc. from the outer SWRConfig are gone */}
</SWRConfig>
```

**Correct (spread the parent config):**

```tsx
<SWRConfig value={(parent) => ({ ...parent, refreshInterval: 5_000 })}>
  {children}
</SWRConfig>
```

Or just use the object form, which merges automatically:

```tsx
<SWRConfig value={{ refreshInterval: 5_000 }}>{children}</SWRConfig>
```

Reference: [SWR — Global Configuration](https://swr.vercel.app/docs/global-configuration)

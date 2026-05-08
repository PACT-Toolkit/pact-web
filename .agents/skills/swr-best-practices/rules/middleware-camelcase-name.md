---
title: Name Middleware in camelCase
impact: MEDIUM
impactDescription: avoids rules-of-hooks lint errors
tags: middleware
---

## Name Middleware in camelCase

SWR middleware is a function that calls hooks (`useSWRNext`). React's rules-of-hooks lint treats PascalCase identifiers as components and bans hook calls in non-component scopes — so a PascalCase middleware function trips the rule even though it's used correctly.

**Incorrect:**

```tsx
const Logger = (useSWRNext) => (key, fetcher, config) => {
  return useSWRNext(key, fetcher, config); // lint error: hook called in 'Logger'
};
```

**Correct:**

```tsx
const logger = (useSWRNext) => (key, fetcher, config) => {
  return useSWRNext(key, fetcher, config);
};
```

Reference: [SWR — Middleware](https://swr.vercel.app/docs/middleware)

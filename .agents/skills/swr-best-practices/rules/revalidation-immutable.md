---
title: Use useSWRImmutable for Static Resources
impact: MEDIUM
impactDescription: cuts background refetches
tags: revalidation, perf
---

## Use useSWRImmutable for Static Resources

`useSWRImmutable` disables `revalidateIfStale`, `revalidateOnFocus`, and `revalidateOnReconnect` in one import — the right default for things that don't change during a session (feature flags loaded once, country lists, currency metadata, copy translations).

**Incorrect (manually disabling each option):**

```tsx
const { data } = useSWR('/api/countries', fetcher, {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
});
```

**Correct:**

```tsx
import useSWRImmutable from 'swr/immutable';

const { data } = useSWRImmutable('/api/countries', fetcher);
```

Reference: [SWR — Revalidate on Mount](https://swr.vercel.app/docs/revalidation)

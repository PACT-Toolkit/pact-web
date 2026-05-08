---
title: Use the Fetcher Type for Standalone Fetchers
impact: LOW
impactDescription: catches key/argument shape drift at compile time
tags: typescript
---

## Use the Fetcher Type for Standalone Fetchers

When a fetcher is defined outside the `useSWR` call (shared across hooks or exported from a module), type it with `Fetcher<Data, Key>` so the argument shape is checked against the key shape used at call sites.

**Incorrect (fetcher type is implicit, drifts from the key):**

```ts
const fetchUser = (id) => api.get(`/users/${id}`).then((r) => r.data);
useSWR(['/api/user', userId], ([, id]) => fetchUser(id));
```

**Correct:**

```ts
import type { Fetcher } from 'swr';

const fetchUser: Fetcher<User, [string, string]> = ([, id]) =>
  api.get(`/users/${id}`).then((r) => r.data);

useSWR(['/api/user', userId], fetchUser);
```

Related: `SWRConfiguration<Data, Error, Fetcher>` for typed config objects, `SWRInfiniteKeyLoader<Data, Key>` for infinite `getKey` functions.

Reference: [SWR — TypeScript](https://swr.vercel.app/docs/typescript)

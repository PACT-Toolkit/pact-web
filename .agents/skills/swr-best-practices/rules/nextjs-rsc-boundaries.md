---
title: SWR Hooks Require 'use client'
impact: HIGH
impactDescription: prevents build-time errors
tags: nextjs, rsc
---

## SWR Hooks Require 'use client'

`useSWR`, `useSWRInfinite`, `useSWRMutation`, and `useSWRSubscription` are client hooks — they rely on browser APIs (focus events, `mutate` ref, deep-equal compare). Calling them from a Server Component crashes the build.

`SWRConfig` and the serialization helpers (`unstable_serialize`) are safe in RSC and exist precisely so server components can hand state down.

**Incorrect (Server Component):**

```tsx
// app/page.tsx (no 'use client')
import useSWR from 'swr';

export default function Page() {
  const { data } = useSWR('/api/user', fetcher); // build error
  return <pre>{JSON.stringify(data)}</pre>;
}
```

**Correct:**

```tsx
'use client';

import useSWR from 'swr';

export default function UserCard() {
  const { data } = useSWR('/api/user', fetcher);
  return <pre>{JSON.stringify(data)}</pre>;
}
```

Reference: [SWR — Next.js App Router](https://swr.vercel.app/docs/with-nextjs)

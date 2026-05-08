---
title: Use useSWRConfig Over Imported Singletons
impact: MEDIUM
impactDescription: respects custom providers
tags: config, mutation, cache
---

## Use useSWRConfig Over Imported Singletons

`useSWRConfig()` returns the `mutate` and `cache` bound to the current provider scope. The imported `mutate` from `'swr'` and `cache` from `'swr/_internal'` always target the default provider — they silently no-op inside subtrees with custom providers (tests, persisted caches, isolated subapps).

**Incorrect:**

```tsx
import { mutate } from 'swr';

function ResetButton() {
  return <button onClick={() => mutate(() => true)}>Reset</button>;
}
```

**Correct:**

```tsx
function ResetButton() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => mutate(() => true)}>Reset</button>;
}
```

Reference: [SWR — useSWRConfig](https://swr.vercel.app/docs/global-configuration#access-to-global-configurations)

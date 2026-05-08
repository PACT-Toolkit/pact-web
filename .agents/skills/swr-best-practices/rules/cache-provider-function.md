---
title: Cache Provider Must Be a Function Returning a Map-Like
impact: MEDIUM
impactDescription: stable cache across remounts
tags: cache, provider
---

## Cache Provider Must Be a Function Returning a Map-Like

`<SWRConfig provider={...}>` accepts a function (called once per mount) that returns an object implementing `get`, `set`, `delete`, and `keys` — the `Map` API surface. Passing the Map instance directly (instead of a function) recreates the cache on every parent render and silently wipes everything.

Define the provider outside the component or hoist the factory to a stable reference.

**Incorrect (new Map on every render):**

```tsx
function App() {
  return (
    <SWRConfig value={{ provider: new Map() }}>
      {/* fresh map every render — every refetch starts cold */}
    </SWRConfig>
  );
}
```

**Correct:**

```tsx
const provider = () => new Map();

function App({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider }}>{children}</SWRConfig>;
}
```

For test isolation, wrap each test's render with a fresh provider Map so the cache resets between cases.

Reference: [SWR — Cache](https://swr.vercel.app/docs/advanced/cache)

---
title: Pass Server Promises Through SWRConfig fallback
impact: MEDIUM
impactDescription: hydrates instantly, no client waterfall
tags: nextjs, rsc, prefetch
---

## Pass Server Promises Through SWRConfig fallback

To hydrate a client `useSWR` with server-fetched data, start the request on the server, pass the promise through `<SWRConfig fallback>`, and let SWR await it during streaming. Awaiting on the server and passing the resolved value blocks streaming; calling `useSWR` on the client without a fallback creates a client-side waterfall.

**Incorrect:**

```tsx
// Server Component
const user = await fetchUser();
return <UserCard initialUser={user} />; // serialized as prop, no SWR cache benefit
```

**Correct:**

```tsx
// Server Component
const userPromise = fetchUser();
return (
  <SWRConfig value={{ fallback: { '/api/user': userPromise } }}>
    <UserCard />
  </SWRConfig>
);

// UserCard.tsx
'use client';
const { data } = useSWR('/api/user', fetcher); // hydrates from fallback
```

For non-string keys (e.g. array-tuple keys), wrap with `unstable_serialize`:

```tsx
fallback: { [unstable_serialize(['api', 'user', id])]: userPromise }
```

Reference: [SWR — Pre-rendering with Default Data](https://swr.vercel.app/docs/with-nextjs#pre-rendering-with-default-data)

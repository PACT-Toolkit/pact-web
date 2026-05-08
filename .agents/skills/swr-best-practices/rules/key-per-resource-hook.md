---
title: Wrap useSWR in a Custom Hook Per Resource
impact: MEDIUM
impactDescription: encapsulation, type safety, reusability
tags: key, patterns
---

## Wrap useSWR in a Custom Hook Per Resource

The first idiom in the SWR docs: build a custom hook for each resource (`useUser`, `useOrders`, `useProject(id)`) instead of calling `useSWR` directly at every consumer. The wrapper owns the key shape, the fetcher, the generics, and any shared options — so changing the endpoint or its shape is one edit instead of dozens.

**Incorrect (key + fetcher repeated at every call site):**

```tsx
function ProfilePage() {
  const { data } = useSWR(['/api/user', userId], ([, id]) => fetchUser(id));
}

function HeaderAvatar() {
  const { data } = useSWR(['/api/user', userId], ([, id]) => fetchUser(id));
}
```

**Correct:**

```tsx
function useUser(userId: string) {
  return useSWR<User, AxiosError>(['/api/user', userId], ([, id]) =>
    fetchUser(id),
  );
}

function ProfilePage() {
  const { data: user } = useUser(userId);
}

function HeaderAvatar() {
  const { data: user } = useUser(userId);
}
```

Multiple consumers of the same key share one underlying request — call the hook freely without worrying about extra requests.

Reference: [SWR — Getting Started](https://swr.vercel.app/docs/getting-started)

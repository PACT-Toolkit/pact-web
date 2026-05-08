---
title: Use Function Keys for Dependent Fetches
impact: MEDIUM
impactDescription: enables automatic chaining
tags: key, conditional, dependent
---

## Use Function Keys for Dependent Fetches

When request B needs a field from request A, return the key for B from a function. SWR catches the throw / falsy and automatically retries when the dependency resolves — no `useEffect` needed.

**Incorrect:**

```tsx
const { data: user } = useSWR('/api/user', fetcher);
const [userId, setUserId] = useState<string>();
useEffect(() => setUserId(user?.id), [user]);
const { data: projects } = useSWR(
  userId ? `/api/projects?uid=${userId}` : null,
  fetcher,
);
```

**Correct:**

```tsx
const { data: user } = useSWR('/api/user', fetcher);
const { data: projects } = useSWR(
  () => `/api/projects?uid=${user.id}`, // throws while user is undefined
  fetcher,
);
```

Independent calls remain parallel; only the dependency chain serializes.

Reference: [SWR — Dependent Fetching](https://swr.vercel.app/docs/conditional-fetching#dependent)

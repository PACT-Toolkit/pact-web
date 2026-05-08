---
title: Distinguish isLoading, isValidating, and isMutating
impact: HIGH
impactDescription: correct loading UI
tags: revalidation, loading, ux
---

## Distinguish isLoading, isValidating, and isMutating

SWR exposes three different loading flags for three different lifecycles. Mixing them produces spinners that flash on every background revalidation, or submit buttons that don't disable while a mutation is in flight.

- `useSWR` returns `isLoading` (true only on the first request, no cache yet) and `isValidating` (true on any in-flight request, including background revalidations).
- `useSWRMutation` returns `isMutating` (true while `trigger()` is running).

**Incorrect (using `isValidating` for a "submit" button):**

```tsx
const { isValidating } = useGetUser();
return <Button loading={isValidating}>Save</Button>; // spins on every focus
```

**Correct:**

```tsx
const { trigger, isMutating } = useUpdateUser();
return <Button loading={isMutating}>Save</Button>;
```

Use `isLoading` for first-paint skeletons; use `isValidating` only when you specifically want to indicate background refresh; use `isMutating` for write-in-flight UI.

Reference: [SWR — useSWR API](https://swr.vercel.app/docs/api)

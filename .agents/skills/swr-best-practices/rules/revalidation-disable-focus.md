---
title: Disable revalidateOnFocus for Write-Sensitive Endpoints
impact: MEDIUM
impactDescription: avoids overwriting in-flight optimistic state
tags: revalidation, mutation
---

## Disable revalidateOnFocus for Write-Sensitive Endpoints

`revalidateOnFocus` is on by default and will refetch every time the user tabs back to the window. For most read endpoints this is fine, but for endpoints that show optimistic state mid-mutation (or expensive analytics rollups), the focus-triggered refetch can race with a write or burn budget.

**Incorrect (focus refetch overwrites optimistic UI):**

```tsx
const { data } = useSWR(limitsKey, fetcher); // re-fetches every focus
```

**Correct:**

```tsx
const { data } = useSWR(limitsKey, fetcher, { revalidateOnFocus: false });
```

Don't disable globally — most reads benefit from focus revalidation. Disable per call site only when there's a specific reason.

Reference: [SWR — Revalidate on Focus](https://swr.vercel.app/docs/revalidation#revalidate-on-focus)

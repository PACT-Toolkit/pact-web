---
title: Use Generics for Typed Returns
impact: LOW
impactDescription: removes any from error and data
tags: typescript
---

## Use Generics for Typed Returns

`useSWR<Data, Error>` makes both the return data and the thrown error type explicit. The default `Error` generic is `any` — which means `error.response.status` type-checks even when the underlying error is something else entirely.

**Incorrect:**

```tsx
const { data, error } = useSWR('/api/user', fetcher);
// data: any | undefined, error: any
```

**Correct:**

```tsx
const { data, error } = useSWR<User, AxiosError<ApiError>>(
  '/api/user',
  fetcher,
);
// data: User | undefined, error: AxiosError<ApiError> | undefined
```

If you use a codegen tool (Orval, openapi-typescript-codegen, etc.) the generated hooks usually provide both generics out of the box — this rule applies to hand-written `useSWR` calls.

Reference: [SWR — TypeScript](https://swr.vercel.app/docs/typescript)

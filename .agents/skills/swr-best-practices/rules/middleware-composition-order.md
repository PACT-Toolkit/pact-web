---
title: Middleware Composes Outer-to-Inner
impact: LOW-MEDIUM
impactDescription: predictable wrap order
tags: middleware
---

## Middleware Composes Outer-to-Inner

When `use` is set on multiple `<SWRConfig>` providers (or a provider plus the hook), middleware wraps in order: outermost provider → inner provider → hook-level. The execution flow is `enter a → enter b → enter c → useSWR → exit c → exit b → exit a` — same as Express middleware or React effects.

```tsx
<SWRConfig value={{ use: [middlewareA] }}>
  <SWRConfig value={{ use: [middlewareB] }}>
    <Component /> {/* useSWR(..., { use: [middlewareC] }) */}
  </SWRConfig>
</SWRConfig>;
// wrap order: a(b(c(useSWR)))
```

If a logger middleware runs at the wrong layer, check the `<SWRConfig>` nesting — the outermost is the first to see the call.

Reference: [SWR — Middleware](https://swr.vercel.app/docs/middleware)

# pact-react-patterns

PACT-specific rules for React state and data-fetching. Combines two constraints:

1. **SWR-first**: all server data goes through SWR (or the orval-generated hooks that wrap it). Never fetch in `useEffect`.
2. **Minimal `useEffect`**: reach for derived state, event handlers, or library APIs first. `useEffect` is the last resort.

Combine with the generic [`swr-best-practices`](../swr-best-practices/SKILL.md) skill for full SWR API details.

---

## Rule 1 — Never fetch in `useEffect`

`useEffect` + `fetch`/`axios` is banned for server data. It causes double-fetching, no deduplication, no cache, and manual loading/error state that diverges from the rest of the app.

```tsx
// ✗ BAD — manual fetch in effect
useEffect(() => {
  fetch('/v1/files').then(r => r.json()).then(setFiles);
}, []);

// ✓ GOOD — orval-generated SWR hook
const { data, error, isLoading } = useListFiles({ limit: 100, offset: 0 });
```

Always use the generated hook from `@/src/__codegen__/rest/{service}/`. If no hook exists, use `useSWR` directly. **No exceptions.**

---

## Rule 2 — Use `useSWRMutation` (or orval mutation hooks) for writes

POST / PATCH / DELETE must go through `useSWRMutation` or the generated `mutateX` wrapper — not a fire-and-forget `fetch` inside an event handler, and certainly not inside a `useEffect`.

```tsx
// ✗ BAD
const handleDelete = async (id: string) => {
  await fetch(`/v1/files/${id}`, { method: 'DELETE' });
  setFiles(prev => prev.filter(f => f.id !== id));
};

// ✓ GOOD — orval mutation + bound SWR mutate for cache invalidation
const handleDelete = async (id: string) => {
  await deleteFile(id);   // orval REST call
  await mutate();         // revalidate the list key
};
```

---

## Rule 3 — Optimistic updates via SWR, not local state

When you need instant UI feedback, use SWR's `optimisticData` + `rollbackOnError`, not a parallel `useState` that you synchronise after the request resolves.

```tsx
// ✗ BAD — local shadow state
const [optimistic, setOptimistic] = useState(items);
const handleAdd = async (item) => {
  setOptimistic(prev => [...prev, item]);
  await postItem(item);
  await mutate();
};

// ✓ GOOD — SWR optimistic
const handleAdd = async (item) => {
  await mutate(postItem(item), {
    optimisticData: (current) => [...(current ?? []), item],
    rollbackOnError: true,
    populateCache: false,
    revalidate: true,
  });
};
```

---

## Rule 4 — Derive state; don't sync it with `useEffect`

If a value can be computed from props, existing state, or SWR data, compute it inline with `useMemo` (or just a plain expression). Do not copy it into a second `useState` and keep them in sync via `useEffect`.

```tsx
// ✗ BAD — derived state synced via effect
const [blocked, setBlocked] = useState(0);
useEffect(() => {
  setBlocked(events.filter(e => e.decision === 'block').length);
}, [events]);

// ✓ GOOD — derived with useMemo
const blocked = useMemo(
  () => events.filter(e => e.decision === 'block').length,
  [events]
);
```

---

## Rule 5 — Use event handlers, not effects, for user actions

Side effects triggered by a user action (click, submit, change) belong in the event handler. `useEffect` that watches a state variable set by a user action is an indirect handler — remove the indirection.

```tsx
// ✗ BAD — effect watching state set by click
const [shouldSubmit, setShouldSubmit] = useState(false);
useEffect(() => {
  if (shouldSubmit) { submitForm(); setShouldSubmit(false); }
}, [shouldSubmit]);

// ✓ GOOD — direct event handler
const handleSubmit = () => submitForm();
```

---

## Rule 6 — Polling via SWR `refreshInterval`, not `setInterval` in `useEffect`

SWR's built-in polling is deduped, respects tab visibility, and tears down automatically. A manual `setInterval` in `useEffect` is harder to reason about and easy to leak.

```tsx
// ✗ BAD — manual interval
useEffect(() => {
  const id = setInterval(() => refetch(), 5000);
  return () => clearInterval(id);
}, []);

// ✓ GOOD — SWR refreshInterval
const { data } = useQueryAuditEvents(params, {
  swr: { refreshInterval: 5_000, revalidateOnFocus: false },
});
```

---

---

## Rule 7 — Use `httpClient` for PACT backend calls, not raw `fetch`

All imperative HTTP calls to PACT backend services must use `httpClient` from `@/src/framework/http`. It is an Axios instance that provides: automatic JSON serialisation, typed response generics, and a centralised 401 → `/login` redirect.

```tsx
import { httpClient } from '@/src/framework/http';

// ✗ BAD — manual JSON, no 401 handling
const resp = await fetch('/api/pact/gateway/v1/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const data = await resp.json() as CheckResponse;

// ✓ GOOD — typed, JSON handled, 401 intercepted
const { data } = await httpClient.post<CheckResponse>(
  '/api/pact/gateway/v1/check',
  payload,
);
```

Use full paths — `httpClient` has no `baseURL`:
- PACT gateway calls: `/api/pact/gateway/v1/...`
- Direct service calls: `/v1/files/...`, `/v1/account/...`

**Keep native `fetch` for:**
- Next.js API routes (`/api/auth/*`) — auth layer has different 401 semantics; the interceptor would loop on login failures
- External APIs (`https://api.pwnedpasswords.com/*`) — no PACT session
- S3 presigned URLs — external object storage with its own auth

**SWR fetcher with `httpClient`** (for raw `useSWR` calls, not orval hooks):
```tsx
const { data } = useSWR<AttackChip[]>(
  '/api/pact/benchmark/v1/corpus/examples',
  (url: string) => httpClient.get<AttackChip[]>(url).then((r) => r.data).catch(() => []),
  { revalidateOnFocus: false },
);
```

---

## When `useEffect` IS acceptable

`useEffect` is the right tool for a narrow set of genuinely imperative, lifecycle-bound effects. These are the only approved uses in pact-web:

| Use case | Notes |
|---|---|
| Subscribing to a browser API (resize, scroll, WebSocket, EventSource) | Requires cleanup; SWR `useSWRSubscription` is preferred for subscriptions |
| Syncing with a third-party imperative library (e.g. a chart, a canvas) | DOM refs that need `element.focus()` or a chart redraw |
| Firing analytics / telemetry on mount or unmount | No reactive alternative |
| Running focus/scroll after a conditional render | Use `useLayoutEffect` if visual; `useEffect` otherwise |
| Kicking off a non-data background task on mount (e.g. `msw:init`) | True side-effect with no reactive equivalent |

If your `useEffect` doesn't fit one of these categories, look for the SWR or derived-state alternative first.

---

## Dependency array rules

When you do write a `useEffect`:

- **List every reactive value used inside the effect.** ESLint `react-hooks/exhaustive-deps` is enforced.
- **Prefer `useCallback`/`useMemo` to stabilise references** rather than omitting them from the dep array.
- **Never suppress `react-hooks/exhaustive-deps`** without a comment explaining the invariant that makes it safe.

---

## SWR key discipline

- **Pass params objects via `useMemo`** so referential identity is stable between renders.
  ```tsx
  const params = useMemo(() => ({ topic: 'pact.decisions', limit: 200 }), []);
  const { data } = useQueryAuditEvents(params);
  ```
- **Return `null` from the key factory to disable** a hook conditionally instead of wrapping it in `if`.
- **Never construct keys with inline object literals** directly in the hook call — they create a new key on every render, defeating the cache.

---

## References

- [`swr-best-practices`](../swr-best-practices/SKILL.md) — full SWR API rules (mutations, pagination, subscriptions, middleware)
- [SWR docs](https://swr.vercel.app/docs) — canonical source
- React docs — [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

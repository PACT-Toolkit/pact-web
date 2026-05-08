---
title: Use Scoped mutate Under Custom Providers
impact: LOW-MEDIUM
impactDescription: tests, persisted caches
tags: cache, provider, test
---

## Use Scoped mutate Under Custom Providers

When a subtree wraps itself with a custom `<SWRConfig provider={() => new Map()}>` (most common in Vitest tests, where each test gets a fresh cache), the imported singleton `mutate` is scoped to the *outer* default provider — it won't reach the test's hooks. Always reach for `useSWRConfig().mutate` in code that may run under a custom provider.

**Incorrect (test using imported mutate):**

```tsx
import { mutate } from 'swr';

test('refresh', async () => {
  render(<App />, { wrapper: createTestWrapper() });
  await mutate('/api/user'); // no-op in the test cache
});
```

**Correct (read mutate from inside the test's render tree):**

```tsx
function RefreshButton() {
  const { mutate } = useSWRConfig();
  return <button onClick={() => mutate('/api/user')}>Refresh</button>;
}

test('refresh', async () => {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <App />
      <RefreshButton />
    </SWRConfig>,
  );
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
});
```

Reference: [SWR — Mutate Multiple Items](https://swr.vercel.app/docs/mutation#mutate-multiple-items)

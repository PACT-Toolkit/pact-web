# Fake clock (`page.clock`) only works for synchronous timer callbacks

Load this when reaching for `page.clock.runFor` / `fastForward`, or when a polling loop mixes `await` calls with sleep timers and you need to test its timeout / retry behavior.

## What `page.clock` does

`page.clock` patches `setTimeout` / `setInterval` in the browser with Sinon-style fake timers. `runFor(N)` fires callbacks **synchronously** — it does **not** `await` async work inside callbacks. `fastForward` has the same limitation.

## Where it breaks

If a timer callback does `async` work — e.g., a polling loop that calls `await fetch(...)` between sleeps — `runFor` fires the first sleep timer, the callback starts, hits `await fetch`, and `runFor` returns immediately, before the fetch completes. The next sleep timer is never set up, so the loop stalls after one iteration.

- **Works fine for** pure-synchronous transitions: `useTimeout`, animation delays, debounces with no async body (like `loans.spec.ts`'s 6 s animation timers).
- **Does NOT work for** polling loops that mix async I/O with sleep timers (like `useDocumentation`'s getPayment polling).

## Workaround options (in order of preference)

1. **Test via a fast error path.** Trigger `MAX_CONSECUTIVE_ERRORS` (e.g. 3 failures) instead of waiting for the full timeout. Add a cookie flag to the MSW handler that returns 500; the hook surfaces the error in ~6 s real time. Same user-visible outcome (error toast + disabled submit) as the timeout path.

2. **Real-time with no-delay mock.** Add a cookie flag that skips `await delay()` in the MSW handler for the polled endpoint. The polling loop's ~1 s browser sleep is the only delay; `test.slow()` (3× default = 90 s) gives enough headroom for `MAX_POLL_ATTEMPTS` (60) × 1 s ≈ 60 s.

3. **Hook-level integration test.** Use React Testing Library + `vi.useFakeTimers()` (or `vi.advanceTimersByTimeAsync`) to unit-test the hook in isolation. RTL awaits async work between timer firings, so it handles mixed async / sync loops correctly.

## Examples

```ts
// Option 1 – consecutive-errors path (fast, ~6 s)
await page.context().addCookies([{ name: 'MOCK_INTL_GET_PAYMENT_FAIL', value: 'true', url: BASE_URL }]);
await expect(page.getByTestId('toast-notification')).toBeVisible({ timeout: 20_000 });
await expect(page.getByTestId('toast-notification')).toContainText('Unable to check document status.');

// Option 2 – real-time timeout path (~60 s) — use test.slow()
// MSW: skip await delay() when MOCK_INTL_DOC_STALL_PROCESSING=true
// Spec:
test.slow(); // 3 × 30 s = 90 s budget
await expect(page.getByTestId('toast-notification')).toBeVisible({ timeout: 75_000 });
await expect(page.getByTestId('toast-notification')).toContainText('Document processing timed out.');
```

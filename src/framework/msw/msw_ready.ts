import { isMock } from '@/src/framework/helpers/environment';

// PACT-455: MSW's browser Service Worker only intercepts requests once it
// has registered, activated, and taken control of the page. Any fetch/XHR
// issued before that point slips straight through to the real network -
// which in dev:mock has no backend behind it. `mocks/index.ts` used to rely
// on msw's `waitUntilReady` start() option to close this gap, but that
// option has been a no-op (deprecation warning only) since this msw
// version - see the removed comment in mocks/index.ts.
//
// `mswReady` is the single source of truth every outgoing request awaits
// before it is allowed to fire for real (see msw_fetch_gate.ts and
// src/framework/http/axios.ts). It resolves immediately everywhere the gate
// doesn't apply - the server (no `window`) and any non-mock build - and
// only stays pending in the browser while mocking is enabled, until
// `signalMswReady()` is called once the worker has started.
const needsGate = typeof window !== 'undefined' && isMock();

let resolveReady: (() => void) | undefined;

export const mswReady: Promise<void> = needsGate
  ? new Promise<void>((resolve) => {
      resolveReady = resolve;
    })
  : Promise.resolve();

// Unblocks every request queued behind `mswReady`. Safe to call more than
// once (e.g. React Strict Mode double-invoking effects) and safe to call
// even when the gate was never armed (needsGate === false) - it's a no-op
// in that case since `resolveReady` was never assigned.
export function signalMswReady(): void {
  resolveReady?.();
}

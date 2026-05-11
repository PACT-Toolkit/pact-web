// Same-origin cross-tab signalling for auth state changes. Used so that
// tab A (the form-submitted screen left over from `/register` or
// `/forgot-password`) can react instantly when tab B finishes the
// email handoff and lands on the success page. The session cookie is
// already shared between the tabs since they're same-origin — the
// only thing missing is the nudge to navigate.
//
// This DOES NOT work across devices: a user who registers on a laptop
// and clicks the email on a phone has two separate cookie jars, two
// separate origins (in dev), and no shared messaging surface. The
// cross-device path is what the visible "Continue here" button on the
// success page is for.
//
// Primary transport is `BroadcastChannel`, which is available in every
// browser we care about (Safari 15.4+). The localStorage `storage`
// event is the fallback for the edge cases where it isn't (or is
// disabled by privacy mode / extensions).
const CHANNEL = 'pact-auth';
const STORAGE_KEY = 'pact:auth-event';

// Discriminated union of cross-tab auth events. Adding a new kind means
// adding a const here and a notify/subscribe pair below. Subscribers
// match on `kind` so the wrong listener never fires.
export const AUTH_EVENT_VERIFIED = 'verified';
export const AUTH_EVENT_PASSWORD_RESET_COMPLETED = 'password_reset_completed';

type AuthEventKind =
  | typeof AUTH_EVENT_VERIFIED
  | typeof AUTH_EVENT_PASSWORD_RESET_COMPLETED;

type AuthEvent = { kind: AuthEventKind; ts: number };

const supportsBroadcastChannel = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.BroadcastChannel === 'function';

// Fire-and-forget: open a channel, post, close. Closing immediately is
// fine — the message is queued before close() resolves on the dispatch
// side, so listeners on other tabs still receive it.
const notifyKind = (kind: AuthEventKind): void => {
  if (typeof window === 'undefined') return;

  const payload: AuthEvent = { kind, ts: Date.now() };

  if (supportsBroadcastChannel()) {
    const ch = new BroadcastChannel(CHANNEL);
    try {
      ch.postMessage(payload);
    } finally {
      ch.close();
    }

    return;
  }

  try {
    // Always include `ts` so a repeat event overwrites the previous
    // value and the storage event actually fires (browsers suppress
    // events when the value is unchanged).
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage might be disabled — at this point the visible "Continue
    // here" button on the success page is the only path forward, which
    // is acceptable.
  }
};

// Returns an unsubscribe function so callers (i.e. React effects) can
// clean up on unmount.
const subscribeToKind = (
  kind: AuthEventKind,
  handler: () => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  if (supportsBroadcastChannel()) {
    const ch = new BroadcastChannel(CHANNEL);
    const onMessage = (e: MessageEvent<AuthEvent>) => {
      if (e.data?.kind === kind) handler();
    };
    ch.addEventListener('message', onMessage);

    return () => {
      ch.removeEventListener('message', onMessage);
      ch.close();
    };
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const data = JSON.parse(e.newValue) as AuthEvent;
      if (data?.kind === kind) handler();
    } catch {
      // Ignore malformed payloads — another tab on a different version
      // may have written something unexpected.
    }
  };
  window.addEventListener('storage', onStorage);

  return () => window.removeEventListener('storage', onStorage);
};

export const notifyVerified = (): void => notifyKind(AUTH_EVENT_VERIFIED);
export const subscribeToVerified = (handler: () => void): (() => void) =>
  subscribeToKind(AUTH_EVENT_VERIFIED, handler);

export const notifyPasswordResetCompleted = (): void =>
  notifyKind(AUTH_EVENT_PASSWORD_RESET_COMPLETED);
export const subscribeToPasswordResetCompleted = (
  handler: () => void
): (() => void) =>
  subscribeToKind(AUTH_EVENT_PASSWORD_RESET_COMPLETED, handler);

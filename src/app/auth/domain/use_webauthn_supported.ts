'use client';

import { useSyncExternalStore } from 'react';

import { isWebAuthnSupported } from './webauthn';

// Shared `useSyncExternalStore` shim: lets components read whether the
// browser supports WebAuthn without tripping a hydration mismatch.
//
// SSR snapshot is OPTIMISTIC (true) because almost every modern browser
// supports WebAuthn — emitting the passkey-enabled UI on the server
// matches the common case, and the post-hydration commit swaps in a
// fallback for the rare unsupported browser. A pessimistic snapshot
// would flash "unsupported" before hydration on every render.
const subscribe = (): (() => void) => () => {};
const getServerSnapshot = (): boolean => true;

export const useWebAuthnSupported = (): boolean =>
  useSyncExternalStore(subscribe, isWebAuthnSupported, getServerSnapshot);

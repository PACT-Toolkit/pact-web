'use client';

import { useSyncExternalStore } from 'react';

import {
  hasPasskeyHintLocally,
  isPasskeyPromptDismissed,
  isWebAuthnSupported,
  subscribePasskeyPromptState,
} from './webauthn';

// Single source of truth for "is the passkey enrollment prompt
// hidden on this device?" - the one visibility rule for the passkey
// nudge. The top-of-app banner is the only surface that renders it, so
// the prompt shows once per page on every route. Keeping the rule here
// means a dismissal (or enrollment) re-renders subscribers with
// hidden=true without a remount, and any future surface reuses the same
// rule instead of growing its own mounted-state + useState wiring.
//
// SSR snapshot is pessimistic (hidden=true) so the server never paints
// the prompt - the post-hydration commit reveals it only if the
// browser actually supports passkeys and the user hasn't already
// dismissed/enrolled. Avoids both a flash-of-prompt on unsupported
// browsers and a hydration mismatch.
const getClientSnapshot = (): boolean => {
  if (!isWebAuthnSupported()) return true;
  if (hasPasskeyHintLocally()) return true;
  if (isPasskeyPromptDismissed()) return true;

  return false;
};

const getServerSnapshot = (): boolean => true;

export const usePasskeyPromptHidden = (): boolean =>
  useSyncExternalStore(
    subscribePasskeyPromptState,
    getClientSnapshot,
    getServerSnapshot
  );

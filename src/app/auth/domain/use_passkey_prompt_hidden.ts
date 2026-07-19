'use client';

import { useSyncExternalStore } from 'react';

import {
  hasPasskeyHintLocally,
  isPasskeyPromptDismissed,
  isWebAuthnSupported,
  subscribePasskeyPromptState,
} from './webauthn';

// Single source of truth for "is the passkey enrollment prompt
// hidden on this device?", shared by every UI surface that wants to
// nudge the user toward passkeys (the top-of-app banner and the
// dashboard CTA today). Centralizing here means:
//
//  - Dismiss in one component → all others re-render with hidden=true,
//    no remount required (was a bug previously, where dismissing the
//    dashboard CTA left the banner visible until next nav).
//  - Each component is a thin "if (hidden) return null" wrapper instead
//    of duplicating its own mounted-state + useState + onEnrolled wiring.
//
// SSR snapshot is pessimistic (hidden=true) so the server never paints
// the prompt — the post-hydration commit reveals it only if the
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

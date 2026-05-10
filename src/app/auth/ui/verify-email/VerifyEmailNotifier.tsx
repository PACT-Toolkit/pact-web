'use client';

import { useEffect } from 'react';

import { notifyVerified } from '@/src/app/auth/domain/auth_broadcast';

// One-shot client component that broadcasts "the user just verified
// their email" to other same-origin tabs. The register tab's
// "Check your email" screen subscribes and self-navigates to
// /dashboard when this fires, so the user doesn't have to flip back to
// the original tab manually.
//
// Lives in its own file so the verify-email/success page can stay a
// server component — only this small piece needs to be client-side.
//
// `useEffect` is the right tool here: a fire-and-forget side effect
// that runs once after mount, with no DOM rendering. The empty
// dependency array makes that intent explicit.
export const VerifyEmailNotifier = () => {
  useEffect(() => {
    notifyVerified();
  }, []);

  return null;
};

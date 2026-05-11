'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { notifyVerified } from '@/src/app/auth/domain/auth_broadcast';

// How long to leave the "Email verified" confirmation visible before
// navigating away. Long enough that the user perceives the success
// state (and so screen readers announce the aria-live region), short
// enough that the wait doesn't feel like a stall.
const AUTO_REDIRECT_DELAY_MS = 1500;

interface Props {
  next: string;
  delayMs?: number;
}

// One-shot client component that runs after a successful email verify.
// Two side effects on mount:
//
//   1. Broadcasts "verified" so any same-origin tab still parked on
//      /register's "Check your email" screen self-navigates to the
//      dashboard. This handles the same-browser-two-tabs flow.
//
//   2. Schedules a router.replace(next) after a short beat so this tab
//      itself auto-forwards to the dashboard too. This handles the
//      different-device flow (laptop register, phone verify): without
//      it the phone would sit on the success page waiting for the user
//      to tap "Continue here". The button stays as a fallback for
//      no-JS / failed timer cases and as a "skip the wait" affordance.
export const VerifyEmailNotifier = ({
  next,
  delayMs = AUTO_REDIRECT_DELAY_MS,
}: Props) => {
  const router = useRouter();

  useEffect(() => {
    notifyVerified();

    const timeoutId = window.setTimeout(() => {
      router.replace(next);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [router, next, delayMs]);

  return null;
};

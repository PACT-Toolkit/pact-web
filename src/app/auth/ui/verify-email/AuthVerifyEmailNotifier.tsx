'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { notifyVerified } from '@/src/app/auth/domain/auth_broadcast';

const AUTO_REDIRECT_DELAY_MS = 1500;

interface Props {
  next: string;
  delayMs?: number;
}

export const AuthVerifyEmailNotifier = ({
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

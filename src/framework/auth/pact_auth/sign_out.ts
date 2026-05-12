'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export const useSignOut = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
  }, [router]);

  return { signOut, pending };
};

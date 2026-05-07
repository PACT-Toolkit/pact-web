'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/src/components/ui/button';

export const LogoutButton = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // server-side cookie was cleared regardless; just continue
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={pending}
      aria-label="Sign out"
    >
      <LogOut size={16} className="mr-2" aria-hidden />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
};

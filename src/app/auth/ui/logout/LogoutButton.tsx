'use client';

import { LogOut } from 'lucide-react';

import { Button } from '@/src/components/ui/button';
import { useSignOut } from '@/src/framework/auth/pact_auth/sign_out';

export const LogoutButton = () => {
  const { signOut, pending } = useSignOut();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={signOut}
      disabled={pending}
      aria-label="Sign out"
    >
      <LogOut size={16} className="mr-2" aria-hidden />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
};

'use client';

import Link from 'next/link';

import { usePasskeyPromptHidden } from '@/src/app/auth/domain/use_passkey_prompt_hidden';
import { dismissPasskeyPrompt } from '@/src/app/auth/domain/webauthn';
import { AuthPasskeyAddButton } from '@/src/app/auth/ui/passkey/AuthPasskeyAddButton';
import { Button } from '@/src/components/ui/button';

export const AuthPasskeyDashboardCTA = () => {
  const hidden = usePasskeyPromptHidden();

  if (hidden) return null;

  return (
    <section
      aria-labelledby="add-passkey-heading"
      className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1">
        <h2 id="add-passkey-heading" className="text-base font-semibold">
          Add a passkey for next time
        </h2>
        <p className="text-sm text-muted-foreground">
          Skip the password on your next sign in. Passkeys use Touch ID, Face
          ID, Windows Hello, or your phone, and they can&apos;t be phished.{' '}
          <Link
            href="/settings/security"
            className="underline underline-offset-4"
          >
            See all sign-in methods
          </Link>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AuthPasskeyAddButton size="lg" />
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={dismissPasskeyPrompt}
        >
          Not now
        </Button>
      </div>
    </section>
  );
};

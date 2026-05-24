'use client';

import { ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';

import { usePasskeyPromptHidden } from '@/src/app/auth/domain/use_passkey_prompt_hidden';
import { dismissPasskeyPrompt } from '@/src/app/auth/domain/webauthn';
import { AuthPasskeyAddButton } from '@/src/app/auth/ui/passkey/AuthPasskeyAddButton';
import { Button } from '@/src/components/ui/button';

type Props = {
  hasPasskeyOrWebauthnMfa?: boolean;
};

export const AuthPasskeyEnrollmentBanner = ({
  hasPasskeyOrWebauthnMfa = false,
}: Props) => {
  const hidden = usePasskeyPromptHidden();

  if (hasPasskeyOrWebauthnMfa || hidden) return null;

  return (
    <div
      role="region"
      aria-label="Passkey enrollment"
      className="border-b bg-positive/10"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-6 py-3">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-positive"
          aria-hidden
        />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <p className="text-sm font-medium">
              Add a passkey for faster, phishing-resistant sign in
            </p>
            <p className="text-sm text-muted-foreground">
              No password to remember or leak. Use Touch ID, Face ID, Windows
              Hello, or your phone.{' '}
              <Link
                href="/settings/security"
                className="underline underline-offset-4"
              >
                Manage sign-in methods
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AuthPasskeyAddButton size="sm" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss"
              onClick={dismissPasskeyPrompt}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

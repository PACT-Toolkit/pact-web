'use client';

import { Info, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import useSWRMutation from 'swr/mutation';

import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  AUTH_KEYS,
  ApiError,
  regenerateRecoveryCodesFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';
import { RecoveryCodesList } from '@/src/framework/auth/recovery_codes_list';

type Props = {
  // Recovery codes are only meaningful as a fallback into an account that
  // has some OTHER sign-in factor to fall back to - a passkey or a TOTP
  // factor both qualify (PACT-714 un-gated this from TOTP-only, since
  // pact-auth now accepts a passkey step-up for RegenerateRecoveryCodes
  // too).
  canGenerate: boolean;
};

export const AuthSettingsRecoveryCodesCard = ({ canGenerate }: Props) => {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useSWRMutation(
    AUTH_KEYS.mfaRecoveryCodes,
    regenerateRecoveryCodesFetcher,
    {
      onSuccess: (data) => {
        setCodes(data?.recoveryCodes ?? null);
      },
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not generate recovery codes.'
        );
      },
    }
  );

  const onGenerate = async () => {
    setError(null);
    try {
      await generate.trigger();
    } catch {
      // no-op
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5" aria-hidden />
          Recovery codes
        </CardTitle>
        <CardDescription>
          One-time codes you can use to get back in if you lose access to your
          other sign-in methods. Generating a new set invalidates the previous
          one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!canGenerate && (
          <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Add a passkey or an authenticator app (TOTP) before generating
              recovery codes. There&apos;s nothing to recover otherwise.
            </span>
          </p>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={generate.isMutating || !canGenerate}
          >
            {generate.isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Generating…
              </>
            ) : codes ? (
              'Regenerate codes'
            ) : (
              'Generate recovery codes'
            )}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {codes && (
          <RecoveryCodesList codes={codes} testId="settings-recovery-codes" />
        )}
      </CardContent>
    </Card>
  );
};

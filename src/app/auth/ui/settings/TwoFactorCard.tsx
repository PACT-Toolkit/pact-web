'use client';

import { Plus, Smartphone } from 'lucide-react';
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
  revokeFactorFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';

import { TotpEnrollPanel } from './TotpEnrollPanel';
import { TotpFactorRow } from './TotpFactorRow';
import { type MfaFactor } from './types';

type Props = {
  factors: MfaFactor[];
  onChanged: () => void;
};

export const TwoFactorCard = ({ factors, onChanged }: Props) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const revokeMutation = useSWRMutation(
    AUTH_KEYS.mfaRevoke,
    revokeFactorFetcher,
    {
      onSuccess: onChanged,
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Could not revoke factor.'
        );
      },
    }
  );

  const onRevoke = async (factorId: string) => {
    setError(null);
    setBusyId(factorId);
    try {
      await revokeMutation.trigger({ factorId });
    } catch {
      // onError populated `error`
    } finally {
      setBusyId(null);
    }
  };

  // Only one verified TOTP factor is supported per user (matches
  // pact-auth's BeginTOTPEnrollment FailedPrecondition). Hide the "Add"
  // button when one is already enrolled so the UI doesn't promise
  // something the backend will reject.
  const hasVerifiedTotp = factors.some(
    (f) => f.type.toLowerCase() === 'totp' && f.verified
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5" aria-hidden />
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          Backup factors for password sign-in. If you have a passkey, you
          don&apos;t strictly need these, but they&apos;re useful as a recovery
          option.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {factors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No two-factor devices on file.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {factors.map((f) => (
              <TotpFactorRow
                key={f.factorId}
                factor={f}
                busy={busyId === f.factorId}
                onRevoke={() => onRevoke(f.factorId)}
              />
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {enrolling ? (
          <TotpEnrollPanel
            onCancel={() => setEnrolling(false)}
            onComplete={() => {
              setEnrolling(false);
              onChanged();
            }}
          />
        ) : (
          !hasVerifiedTotp && (
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setEnrolling(true);
                }}
                data-testid="totp-add"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Add authenticator app
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};

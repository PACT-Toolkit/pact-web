'use client';

import { Fingerprint, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import useSWRMutation from 'swr/mutation';

import { useWebAuthnSupported } from '@/src/app/auth/domain/use_webauthn_supported';
import { AuthPasskeyAddButton } from '@/src/app/auth/ui/passkey/AuthPasskeyAddButton';
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
  deletePasskeyFetcher,
  renamePasskeyFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';

import { AuthSettingsPasskeyRow } from './AuthSettingsPasskeyRow';
import { type Passkey } from './types';

type Props = {
  passkeys: Passkey[];
  onChanged: () => void;
};

export const AuthSettingsPasskeysCard = ({ passkeys, onChanged }: Props) => {
  const supported = useWebAuthnSupported();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renameMutation = useSWRMutation(
    AUTH_KEYS.passkeyRename,
    renamePasskeyFetcher,
    {
      onSuccess: onChanged,
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Could not rename passkey.'
        );
      },
    }
  );
  const deleteMutation = useSWRMutation(
    AUTH_KEYS.passkeyDelete,
    deletePasskeyFetcher,
    {
      onSuccess: onChanged,
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError ? err.message : 'Could not remove passkey.'
        );
      },
    }
  );

  const onRename = async (passkeyId: string, label: string) => {
    setError(null);
    setBusyId(passkeyId);
    try {
      await renameMutation.trigger({ passkeyId, label });
    } catch {
      // no-op
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (passkeyId: string) => {
    setError(null);
    setBusyId(passkeyId);
    try {
      await deleteMutation.trigger({ passkeyId });
    } catch {
      // no-op
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Fingerprint className="h-5 w-5" aria-hidden />
          Passkeys
        </CardTitle>
        <CardDescription>
          The strongest sign-in option. Phishing-resistant, no shared secret,
          unlocked with Touch ID, Face ID, Windows Hello, or your phone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {passkeys.length > 0 && (
          <ul className="flex flex-col gap-2">
            {passkeys.map((p) => (
              <AuthSettingsPasskeyRow
                key={p.passkeyId}
                passkey={p}
                busy={busyId === p.passkeyId}
                onRename={(label) => onRename(p.passkeyId, label)}
                onDelete={() => onDelete(p.passkeyId)}
              />
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {supported ? (
          <AuthPasskeyAddButton showLabelInput onEnrolled={onChanged} />
        ) : (
          <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              This browser doesn&apos;t support passkeys. Try a recent version
              of Chrome, Safari, Edge, or Firefox.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

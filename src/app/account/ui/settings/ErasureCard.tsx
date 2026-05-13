'use client';

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useRequestAccountErasure } from '@/src/__codegen__/rest/account';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/src/components/ui/field';
import { Input } from '@/src/components/ui/input';

import { ERASURE_CONFIRM } from './helpers';

export const ErasureCard = () => {
  const router = useRouter();
  const erase = useRequestAccountErasure();

  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const armed = confirmText === ERASURE_CONFIRM;

  const onErase = async () => {
    if (!armed) return;
    setError(null);
    try {
      await erase.trigger(undefined);
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // no-op
      }
      router.push('/login?erased=1');
      router.refresh();
    } catch {
      setError(
        'Could not submit erasure request. The request was not recorded; please try again.'
      );
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" aria-hidden />
          Request account erasure
        </CardTitle>
        <CardDescription>
          GDPR Article 17. We delete your pact-account row immediately and emit
          a cascade event so connected services run their own deletion.
          Cross-service completion is asynchronous; we acknowledge the request
          right away.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
              aria-hidden
            />
            <FieldContent>
              <FieldTitle>This cannot be undone.</FieldTitle>
              <FieldDescription>
                Once submitted you will be signed out and your data will be
                queued for deletion. Sign-in will fail until our support team
                manually re-creates the account, which we generally do not do.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="erasure-confirm">
              Type <span className="font-mono">{ERASURE_CONFIRM}</span> to
              enable the button
            </FieldLabel>
            <Input
              id="erasure-confirm"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={ERASURE_CONFIRM}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Field orientation="horizontal">
            <Button
              type="button"
              variant="destructive"
              disabled={!armed || erase.isMutating}
              onClick={() => void onErase()}
            >
              {erase.isMutating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                  Erase my account
                </>
              )}
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
};

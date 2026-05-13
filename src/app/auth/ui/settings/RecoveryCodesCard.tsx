'use client';

import { Copy, Info, KeyRound, Loader2, TriangleAlert } from 'lucide-react';
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

type Props = {
  hasTotp: boolean;
};

export const RecoveryCodesCard = ({ hasTotp }: Props) => {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    try {
      await generate.trigger();
    } catch {
      // no-op
    }
  };

  const onCopy = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch {
      setError('Could not copy to clipboard.');
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
          One-time codes you can use to get back in if you lose your
          authenticator. Generating a new set invalidates the previous one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!hasTotp && (
          <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Add an authenticator app (TOTP) before generating recovery codes.
              There&apos;s nothing to recover otherwise.
            </span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={generate.isMutating || !hasTotp}
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
          {codes && (
            <Button type="button" variant="ghost" onClick={onCopy}>
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              {copied ? 'Copied' : 'Copy all'}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {codes && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                aria-hidden
              />
              <span>Save these now. We&apos;ll only show them once.</span>
            </p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3">
              {codes.map((c) => (
                <li key={c} className="rounded bg-background px-2 py-1">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

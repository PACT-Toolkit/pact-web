'use client';

import { Check, Copy, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import useSWRMutation from 'swr/mutation';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  AUTH_KEYS,
  ApiError,
  beginTotpEnrollmentFetcher,
  type BeginTotpEnrollmentResult,
  confirmTotpEnrollmentFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';
import { cn } from '@/src/lib/utils';

type Props = {
  onComplete: () => void;
  onCancel: () => void;
};

type Stage = 'begin' | 'verify' | 'recovery';

export const TotpEnrollPanel = ({ onComplete, onCancel }: Props) => {
  const [stage, setStage] = useState<Stage>('begin');
  const [enrollment, setEnrollment] =
    useState<BeginTotpEnrollmentResult | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const beginMutation = useSWRMutation(
    AUTH_KEYS.mfaEnrollBegin,
    beginTotpEnrollmentFetcher,
    {
      onSuccess: (data) => {
        setEnrollment(data ?? null);
        setStage('verify');
      },
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not start authenticator setup.'
        );
      },
    }
  );

  const confirmMutation = useSWRMutation(
    AUTH_KEYS.mfaEnrollConfirm,
    confirmTotpEnrollmentFetcher,
    {
      onSuccess: (data) => {
        setRecoveryCodes(data?.recoveryCodes ?? []);
        setStage('recovery');
      },
      onError: (err: unknown) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not verify the code. Try again.'
        );
      },
    }
  );

  const onBegin = async () => {
    setError(null);
    try {
      await beginMutation.trigger();
    } catch {
      // no-op
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setError(null);
    try {
      await confirmMutation.trigger({
        factorId: enrollment.factorId,
        code: code.trim(),
      });
    } catch {
      // no-op
    }
  };

  const onCopySecret = async () => {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopiedSecret(true);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const onCopyCodes = async () => {
    if (recoveryCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopiedCodes(true);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  if (stage === 'begin') {
    return (
      <div
        data-testid="totp-enroll-panel"
        data-stage="begin"
        className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4"
      >
        <p className="text-sm text-muted-foreground">
          Set up an authenticator app (1Password, Google Authenticator, Authy,
          etc.) as a backup factor for password sign-in.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={onBegin}
            disabled={beginMutation.isMutating}
            data-testid="totp-begin"
          >
            {beginMutation.isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Starting…
              </>
            ) : (
              'Start setup'
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'verify' && enrollment) {
    return (
      <form
        onSubmit={onVerify}
        data-testid="totp-enroll-panel"
        data-stage="verify"
        className="flex flex-col gap-4 rounded-md border bg-muted/30 p-4"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Add this secret to your authenticator app, then enter the 6-digit
            code it shows.
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid="totp-secret"
              className="flex-1 rounded border bg-background px-2 py-1 font-mono text-sm break-all"
            >
              {enrollment.secret}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopySecret}
              aria-label="Copy authenticator secret"
            >
              {copiedSecret ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
          <p
            data-testid="totp-otpauth-url"
            className="break-all text-xs text-muted-foreground"
          >
            <span className="sr-only">otpauth URL: </span>
            {enrollment.otpauthUrl}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="totp-code">Verification code</Label>
          <Input
            id="totp-code"
            data-testid="totp-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            }
            placeholder="123456"
            className={cn('font-mono text-base tracking-widest')}
          />
        </div>

        {error && (
          <p
            role="alert"
            data-testid="totp-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            disabled={confirmMutation.isMutating || code.length !== 6}
            data-testid="totp-verify"
          >
            {confirmMutation.isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              'Verify and enable'
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div
      data-testid="totp-enroll-panel"
      data-stage="recovery"
      className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-success"
          aria-hidden
        />
        <span>Authenticator enabled. Save your recovery codes now.</span>
      </p>
      <p className="flex items-start gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
        <TriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-warning"
          aria-hidden
        />
        <span>
          We&apos;ll only show these once. Without them, losing your
          authenticator means losing access.
        </span>
      </p>
      <ul
        data-testid="totp-recovery-codes"
        className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3"
      >
        {recoveryCodes.map((c) => (
          <li key={c} className="rounded bg-background px-2 py-1">
            {c}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onCopyCodes}>
          <Copy className="mr-2 h-4 w-4" aria-hidden />
          {copiedCodes ? 'Copied' : 'Copy all'}
        </Button>
        <Button
          type="button"
          onClick={onComplete}
          data-testid="totp-enroll-done"
        >
          Done
        </Button>
      </div>
    </div>
  );
};

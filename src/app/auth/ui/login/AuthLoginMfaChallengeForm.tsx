'use client';

import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWRMutation from 'swr/mutation';

import { useWebAuthnSupported } from '@/src/app/auth/domain/use_webauthn_supported';
import {
  completeMfaWithPasskey,
  PasskeyError,
} from '@/src/app/auth/domain/webauthn';
import { AuthErrorNotice } from '@/src/app/auth/ui/AuthErrorNotice';
import { Button } from '@/src/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/src/components/ui/field';
import { Input } from '@/src/components/ui/input';
import { MFA_STEP_UP_ERROR_CODES } from '@/src/framework/auth/pact_auth/errors';
import {
  AUTH_KEYS,
  ApiError,
  verifyMfaFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';

type ServerError = { code: string | null; message: string };

type AuthLoginMfaChallengeFormProps = {
  // Absolute post-MFA redirect target, carried in from the OAuth callback
  // (see app/(auth)/login/mfa/page.tsx). Undefined for the password-login
  // MFA path, which has no return_to concept and always lands on /dashboard.
  // May be cross-origin (dev cross-device flows, PACT_AUTH_DEFAULT_RETURN_TO),
  // so a full navigation is used instead of the client-side router.
  returnTo?: string;
};

export const AuthLoginMfaChallengeForm = ({
  returnTo,
}: AuthLoginMfaChallengeFormProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const passkeySupported = useWebAuthnSupported();

  const goToExpiredLogin = () => {
    router.replace(
      `/login?oauth_error=${encodeURIComponent('challenge_expired')}`
    );
  };

  const verify = useSWRMutation(AUTH_KEYS.mfaVerify, verifyMfaFetcher, {
    onSuccess: () => {
      if (returnTo) {
        window.location.href = returnTo;

        return;
      }
      router.push('/dashboard');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (
          err.info?.code === MFA_STEP_UP_ERROR_CODES.challengeExpired ||
          err.info?.code === MFA_STEP_UP_ERROR_CODES.noChallenge
        ) {
          goToExpiredLogin();

          return;
        }
        setServerError({
          code: err.info?.code ?? null,
          message: err.message,
        });

        return;
      }
      setServerError({
        code: null,
        message: 'Network error. Please try again.',
      });
    },
  });

  // Alternative to the TOTP/recovery-code form below (PACT-697). A ceremony
  // that never reaches the server (cancelled, unsupported) or one pact-auth
  // rejects before consuming the mfa_token never disables the code input or
  // submit button - the TOTP path stays fully usable. One that pact-auth
  // parses but fails to verify has already consumed the token by the time
  // the failure comes back (passkey_failed), same as the finish route's
  // challenge_expired/no_challenge cases - the catch block below redirects
  // on all three immediately instead of waiting for a doomed TOTP submit to
  // discover it. See completeMfaWithPasskey's and the finish route's
  // docblocks.
  const onPasskeyClick = async () => {
    setValidationError(null);
    setServerError(null);
    setPasskeyPending(true);
    try {
      await completeMfaWithPasskey();
      if (returnTo) {
        window.location.href = returnTo;

        return;
      }
      router.push('/dashboard');
    } catch (err) {
      setPasskeyPending(false);
      if (err instanceof ApiError) {
        // The finish route's { code, error } body - challenge_expired and
        // no_challenge mean the mfa_token is dead (same as the TOTP path
        // above), and passkey_failed means this very call is what just
        // consumed it (see completeMfaWithPasskey's docblock). All three
        // leave nothing left to retry on this page, so bounce the same way.
        if (
          err.info?.code === MFA_STEP_UP_ERROR_CODES.challengeExpired ||
          err.info?.code === MFA_STEP_UP_ERROR_CODES.noChallenge ||
          err.info?.code === MFA_STEP_UP_ERROR_CODES.passkeyFailed
        ) {
          goToExpiredLogin();

          return;
        }
        setServerError({ code: err.info?.code ?? null, message: err.message });

        return;
      }
      if (err instanceof PasskeyError) {
        if (err.code === 'cancelled') return;
        setServerError({ code: null, message: err.message });

        return;
      }
      setServerError({
        code: null,
        message: 'Passkey verification failed. Please try again.',
      });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setServerError(null);

    const trimmed = code.trim();
    if (mode === 'totp' && !/^\d{6}$/.test(trimmed)) {
      setValidationError('Enter the 6-digit code from your authenticator app.');

      return;
    }
    if (mode === 'recovery' && trimmed.length < 6) {
      setValidationError('Enter the recovery code you saved at enrolment.');

      return;
    }

    try {
      await verify.trigger({ code: trimmed, isRecovery: mode === 'recovery' });
    } catch {
      // no-op
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'totp' ? 'recovery' : 'totp'));
    setCode('');
    setValidationError(null);
    setServerError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-bold">Two-factor verification</h1>
        <FieldDescription>
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of the recovery codes you saved when you enrolled.'}
        </FieldDescription>
      </div>

      {passkeySupported && (
        <FieldGroup>
          <Field>
            <Button
              type="button"
              variant="outline"
              data-testid="mfa-passkey-button"
              onClick={onPasskeyClick}
              disabled={verify.isMutating || passkeyPending}
            >
              {passkeyPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Waiting for passkey…
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" aria-hidden />
                  Use a passkey instead
                </>
              )}
            </Button>
          </Field>
          <FieldSeparator>Or enter a code</FieldSeparator>
        </FieldGroup>
      )}

      {serverError && (
        <AuthErrorNotice
          code={serverError.code}
          message={serverError.message}
        />
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!validationError}>
            <FieldLabel htmlFor="mfa-code">
              {mode === 'totp' ? 'Authenticator code' : 'Recovery code'}
            </FieldLabel>
            <Input
              id="mfa-code"
              data-testid="mfa-code-input"
              inputMode={mode === 'totp' ? 'numeric' : 'text'}
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={mode === 'totp' ? 6 : 24}
              pattern={mode === 'totp' ? '\\d{6}' : undefined}
              value={code}
              onChange={(e) => {
                const next =
                  mode === 'totp'
                    ? e.target.value.replace(/\D/g, '').slice(0, 6)
                    : e.target.value;
                setCode(next);
              }}
              placeholder={mode === 'totp' ? '123456' : 'XXXX-XXXX'}
              className="font-mono text-base tracking-widest"
              aria-invalid={!!validationError}
            />
            {validationError && <FieldError>{validationError}</FieldError>}
          </Field>

          <Field>
            <Button
              type="submit"
              data-testid="mfa-verify"
              disabled={
                verify.isMutating || passkeyPending || code.length === 0
              }
            >
              {verify.isMutating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                'Verify and sign in'
              )}
            </Button>
          </Field>

          <FieldDescription className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              data-testid="mfa-toggle-mode"
              className="underline-offset-4 hover:underline"
            >
              {mode === 'totp'
                ? 'Use a recovery code instead'
                : 'Use your authenticator app instead'}
            </button>
          </FieldDescription>

          <FieldDescription className="text-center">
            <Link href="/login">Cancel and sign in again</Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </div>
  );
};

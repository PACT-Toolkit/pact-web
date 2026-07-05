'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Fingerprint, Info, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWRMutation from 'swr/mutation';

import {
  loginSchema,
  type LoginFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
import { useWebAuthnSupported } from '@/src/app/auth/domain/use_webauthn_supported';
import {
  PasskeyError,
  isConditionalMediationSupported,
  isWebAuthnSupported,
  markPasskeyEnrolledLocally,
  signInWithPasskey,
} from '@/src/app/auth/domain/webauthn';
import { AuthErrorNotice } from '@/src/app/auth/ui/AuthErrorNotice';
import { OAUTH_PROVIDERS } from '@/src/app/auth/ui/login/oauth_providers';
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
import {
  AUTH_KEYS,
  ApiError,
  loginFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';
import { cn } from '@/src/lib/utils';

type LoginFormProps = React.ComponentProps<'div'> & {
  initialError?: string | null;
  // Where to send the user after a successful password or passkey sign-in.
  // Defaults to /dashboard when the caller has nothing more specific (see
  // app/(auth)/login/page.tsx, which resolves this via safeNextPath so it's
  // always a safe same-origin path by the time it gets here). Not used on
  // the MFA step-up branch - see AuthLoginMfaChallengeForm's docblock.
  returnTo?: string;
};

type ServerError = { code: string | null; message: string };

export const AuthLoginForm = ({
  initialError,
  returnTo = '/dashboard',
  className,
  ...props
}: LoginFormProps) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerError | null>(
    initialError ? { code: null, message: initialError } : null
  );
  const passkeySupported = useWebAuthnSupported();
  const [pending, setPending] = useState(false);
  const conditionalAbort = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  const loginMutation = useSWRMutation(AUTH_KEYS.login, loginFetcher, {
    onSuccess: (data) => {
      if (data?.mfaRequired) {
        router.push('/login/mfa');

        return;
      }
      router.push(returnTo);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
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

  useEffect(() => {
    if (!isWebAuthnSupported()) return;

    let cancelled = false;
    void (async () => {
      if (!(await isConditionalMediationSupported())) return;
      if (cancelled) return;

      const ctrl = new AbortController();
      conditionalAbort.current = ctrl;
      try {
        await signInWithPasskey({
          mediation: 'conditional',
          signal: ctrl.signal,
        });
        if (cancelled) return;
        markPasskeyEnrolledLocally();
        router.push(returnTo);
      } catch (err) {
        if (err instanceof PasskeyError && err.code !== 'cancelled') {
          setServerError({ code: null, message: err.message });
        }
      }
    })();

    return () => {
      cancelled = true;
      conditionalAbort.current?.abort();
    };
  }, [router, returnTo]);

  const onPasskeyClick = async () => {
    setServerError(null);
    setPending(true);
    conditionalAbort.current?.abort();
    try {
      await signInWithPasskey();
      markPasskeyEnrolledLocally();
      router.push(returnTo);
    } catch (err) {
      setPending(false);
      if (err instanceof PasskeyError) {
        if (err.code === 'cancelled') return;
        setServerError({ code: null, message: err.message });

        return;
      }
      setServerError({
        code: null,
        message: 'Passkey sign-in failed. Please try again.',
      });
    }
  };

  const onSubmit = async ({ email, password }: LoginFormData) => {
    setServerError(null);
    try {
      await loginMutation.trigger({ email, password });
    } catch {
      // no-op
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-bold">Welcome back to PACT</h1>
        <FieldDescription>
          Don&apos;t have an account? <Link href="/register">Sign up</Link>
        </FieldDescription>
      </div>

      <FieldGroup>
        {passkeySupported ? (
          <Field>
            <Button
              type="button"
              size="lg"
              onClick={onPasskeyClick}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Waiting for passkey…
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" aria-hidden />
                  Sign in with a passkey
                </>
              )}
            </Button>
          </Field>
        ) : (
          <Field>
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Passkeys aren&apos;t supported in this browser. Sign in with a
                provider or your email below.
              </span>
            </div>
          </Field>
        )}

        <Field className="grid grid-cols-3 gap-3">
          {OAUTH_PROVIDERS.map(({ id, name, iconPath }) => (
            <Button
              key={id}
              variant="outline"
              asChild
              className="flex h-auto flex-col gap-1.5 py-3"
            >
              <a href={`/api/auth/oauth/start?provider=${id}`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="size-5"
                  aria-hidden
                >
                  <path d={iconPath} fill="currentColor" />
                </svg>
                <span className="text-sm">{name}</span>
              </a>
            </Button>
          ))}
        </Field>

        <FieldSeparator>Or sign in with email</FieldSeparator>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="username webauthn"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.password}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <FieldError>{errors.password.message}</FieldError>
              )}
            </Field>

            {serverError && (
              <AuthErrorNotice
                code={serverError.code}
                message={serverError.message}
              />
            )}

            <Field>
              <Button
                type="submit"
                variant="outline"
                disabled={loginMutation.isMutating}
              >
                {loginMutation.isMutating ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden
                    />
                    Signing in…
                  </>
                ) : (
                  'Sign in with password'
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </FieldGroup>

      <FieldDescription className="px-6 text-center">
        By signing in you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
};

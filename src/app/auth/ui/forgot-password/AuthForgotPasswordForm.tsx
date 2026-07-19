'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { subscribeToPasswordResetCompleted } from '@/src/app/auth/domain/auth_broadcast';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
import { AuthErrorNotice } from '@/src/app/auth/ui/AuthErrorNotice';
import { Button } from '@/src/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/src/components/ui/field';
import { Input } from '@/src/components/ui/input';
import {
  apiErrorToFormError,
  AUTH_KEYS,
  forgotPasswordFetcher,
} from '@/src/framework/auth/pact_auth/web_mutations';
import { cn } from '@/src/lib/utils';

type Props = React.ComponentProps<'div'>;

type ServerError = { code: string | null; message: string };

export const AuthForgotPasswordForm = ({ className, ...props }: Props) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;

    return subscribeToPasswordResetCompleted(() => {
      router.replace('/dashboard');
    });
  }, [submitted, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    try {
      await forgotPasswordFetcher(AUTH_KEYS.forgotPassword, {
        arg: { email: data.email },
      });
    } catch (err) {
      setServerError(apiErrorToFormError(err));

      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-4 text-center',
          className
        )}
        {...props}
      >
        <h1 className="text-xl font-bold">Check your email</h1>
        <FieldDescription>
          If an account exists for that address, we&apos;ve sent a password
          reset link. The link expires in an hour.
        </FieldDescription>
        <Link href="/login" className="text-sm underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold">Reset your password</h1>
            <FieldDescription>
              Enter your email and we&apos;ll send you a reset link.
            </FieldDescription>
          </div>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </Field>

          {serverError && (
            <AuthErrorNotice
              code={serverError.code}
              message={serverError.message}
            />
          )}

          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
          </Field>

          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </FieldGroup>
      </form>
    </div>
  );
};

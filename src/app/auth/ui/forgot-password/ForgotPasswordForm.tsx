'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
import { Button } from '@/src/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/src/components/ui/field';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';

type Props = React.ComponentProps<'div'>;

export const ForgotPasswordForm = ({ className, ...props }: Props) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
    } catch {
      setServerError('Network error. Please try again.');

      return;
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setServerError(payload?.error ?? 'Request failed. Please try again.');

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
            <FieldError role="alert" className="text-center">
              {serverError}
            </FieldError>
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

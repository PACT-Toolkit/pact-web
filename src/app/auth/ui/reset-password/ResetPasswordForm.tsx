'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { notifyPasswordResetCompleted } from '@/src/app/auth/domain/auth_broadcast';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
import { usePasswordBreachWarning } from '@/src/app/auth/domain/use_password_breach_warning';
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
import { cn } from '@/src/lib/utils';

type Props = React.ComponentProps<'div'> & {
  token: string;
};

type ServerError = { code: string | null; message: string };

export const ResetPasswordForm = ({ token, className, ...props }: Props) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const { warning: breachWarning, onPasswordBlur } = usePasswordBreachWarning();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
  });

  const passwordRegister = register('password');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
    } catch {
      setServerError({
        code: null,
        message: 'Network error. Please try again.',
      });

      return;
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      setServerError({
        code: payload?.code ?? null,
        message: payload?.error ?? 'Reset failed. Please try again.',
      });

      return;
    }
    // Cross-tab nudge: if the user requested the reset in another tab
    // (still showing the /forgot-password "Check your email" screen),
    // that tab subscribes and self-navigates to /dashboard. Fire it
    // before the local router.push so the broadcast happens while this
    // tab is still alive on the same origin.
    notifyPasswordResetCompleted();
    router.push('/dashboard');
  };

  if (!token) {
    return (
      <div
        className={cn(
          'flex flex-col items-center gap-4 text-center',
          className
        )}
        {...props}
      >
        <h1 className="text-xl font-bold">Missing reset token</h1>
        <FieldDescription>
          This reset link is malformed. Try requesting a new one.
        </FieldDescription>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold">Choose a new password</h1>
            <FieldDescription>
              At least 15 characters. We&apos;ll sign you in once you&apos;re
              done.
            </FieldDescription>
          </div>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...passwordRegister}
              onBlur={(e) => {
                void passwordRegister.onBlur(e);
                onPasswordBlur(e);
              }}
            />
            {errors.password && (
              <FieldError>{errors.password.message}</FieldError>
            )}
            {breachWarning && !errors.password && (
              <p className="flex items-center gap-1.5 text-sm text-warning">
                <TriangleAlert size={14} aria-hidden />
                This password has appeared in a data breach. Consider choosing a
                different one.
              </p>
            )}
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <FieldError>{errors.confirmPassword.message}</FieldError>
            )}
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
                  Resetting…
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
};

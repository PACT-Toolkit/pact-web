'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  loginSchema,
  type LoginFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
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
import { cn } from '@/src/lib/utils';

type LoginFormProps = React.ComponentProps<'div'> & {
  initialError?: string | null;
};

export const LoginForm = ({
  initialError,
  className,
  ...props
}: LoginFormProps) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(
    initialError ?? null
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  const onSubmit = async ({ email, password }: LoginFormData) => {
    setServerError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setServerError(payload?.error ?? 'Sign in failed. Please try again.');

        return;
      }
      router.push('/dashboard');
    } catch {
      setServerError('Network error. Please try again.');
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold">Welcome back to PACT</h1>
            <FieldDescription>
              Don&apos;t have an account? <Link href="/register">Sign up</Link>
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
            <FieldError role="alert" className="text-center">
              {serverError}
            </FieldError>
          )}

          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </Field>

          <FieldSeparator>Or</FieldSeparator>

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
        </FieldGroup>
      </form>

      <FieldDescription className="px-6 text-center">
        By signing in you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
};

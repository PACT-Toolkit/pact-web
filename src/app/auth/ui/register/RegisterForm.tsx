'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import { Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  registerSchema,
  type RegisterFormData,
} from '@/src/app/auth/domain/auth_validation_schema';
import { checkBreach } from '@/src/app/auth/domain/check_breach';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

export const RegisterForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [breachWarning, setBreachWarning] = useState(false);
  const breachAbort = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: yupResolver(registerSchema),
  });

  const passwordRegister = register('password');

  const onPasswordBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const pw = e.target.value;
      setBreachWarning(false);
      breachAbort.current?.abort();
      if (pw.length < 15) return;
      const ctrl = new AbortController();
      breachAbort.current = ctrl;
      checkBreach(pw, ctrl.signal).then((hit) => {
        if (!ctrl.signal.aborted) setBreachWarning(hit);
      });
    },
    []
  );

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    let res: Response;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          display_name: data.displayName,
        }),
      });
    } catch {
      setServerError('Network error. Please try again.');

      return;
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setServerError(
        payload?.error ?? 'Registration failed. Please try again.'
      );

      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription>
            We sent a verification link to your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p className="mb-4">
            Click the link to finish creating your account. The link expires in
            an hour.
          </p>
          <Link href="/login" className="underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight">
          PACT
        </CardTitle>
        <CardDescription>Create an account</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={!!errors.displayName}
              aria-describedby={errors.displayName ? 'name-error' : undefined}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p
                id="name-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 15 characters"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                {...passwordRegister}
                onBlur={(e) => {
                  void passwordRegister.onBlur(e);
                  onPasswordBlur(e);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.password.message}
              </p>
            )}
            {breachWarning && !errors.password && (
              <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                <TriangleAlert size={14} aria-hidden />
                This password has appeared in a data breach. Consider choosing a
                different one.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? 'confirm-password-error' : undefined
              }
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p
                id="confirm-password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-destructive text-center">
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full mt-1">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};

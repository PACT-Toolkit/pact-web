import { redirect } from 'next/navigation';

import { AuthLoginForm } from '@/src/app/auth';
import { validateSessionFromCookies } from '@/src/framework/auth/pact_auth/session';

type SearchParams = {
  oauth_error?: string | string[];
  erased?: string | string[];
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  unknown_provider: 'Unknown OAuth provider.',
  missing_code_or_state: 'OAuth response was malformed. Try again.',
  missing_state_cookie:
    'Your session expired before the OAuth flow finished. Try again.',
  state_or_code_invalid: 'OAuth response failed verification. Try again.',
  callback_failed: 'OAuth sign-in failed. Try again.',
  access_denied: 'You declined the sign-in request.',
  email_already_linked:
    'That email is already linked to a different sign-in method. Sign in with the original provider, then connect this one from your account settings.',
  challenge_expired:
    'Your two-factor verification timed out. Enter your password again.',
};

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const session = await validateSessionFromCookies();
  if (session) {
    redirect('/dashboard');
  }

  const { oauth_error, erased } = await searchParams;
  const errKey = Array.isArray(oauth_error) ? oauth_error[0] : oauth_error;
  const oauthError = errKey
    ? (OAUTH_ERROR_MESSAGES[errKey] ?? 'OAuth sign-in failed. Try again.')
    : null;
  const erasedConfirmed = (Array.isArray(erased) ? erased[0] : erased) === '1';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        {erasedConfirmed && (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-100"
          >
            Your account has been queued for deletion. Connected services will
            run their own deletion asynchronously.
          </div>
        )}
        <AuthLoginForm initialError={oauthError} />
      </div>
    </div>
  );
};

export default LoginPage;

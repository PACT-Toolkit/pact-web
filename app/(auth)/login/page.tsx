import { LoginForm } from '@/src/app/auth';

type SearchParams = { oauth_error?: string | string[] };

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
  // Surfaced when /login/mfa is reached without a fresh challenge token
  // (or it expired mid-flow). The MFA form redirects here so the user
  // re-enters their password and gets a new mfa_token.
  challenge_expired:
    'Your two-factor verification timed out. Enter your password again.',
};

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { oauth_error } = await searchParams;
  const errKey = Array.isArray(oauth_error) ? oauth_error[0] : oauth_error;
  const oauthError = errKey
    ? (OAUTH_ERROR_MESSAGES[errKey] ?? 'OAuth sign-in failed. Try again.')
    : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm initialError={oauthError} />
      </div>
    </div>
  );
};

export default LoginPage;

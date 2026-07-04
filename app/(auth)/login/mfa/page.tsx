import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthLoginMfaChallengeForm } from '@/src/app/auth';

const MFA_TOKEN_COOKIE = 'pact_mfa_token';
// Set only by the OAuth callback route (app/v1/auth/callback/[provider])
// when it hits the MFA gate. Absent for the password-login MFA path, which
// always resumes at /dashboard.
const OAUTH_RETURN_TO_COOKIE = 'pact_oauth_return_to';

const LoginMfaPage = async () => {
  const jar = await cookies();
  const mfaToken = jar.get(MFA_TOKEN_COOKIE)?.value;
  if (!mfaToken) {
    redirect('/login');
  }
  const returnTo = jar.get(OAUTH_RETURN_TO_COOKIE)?.value;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthLoginMfaChallengeForm returnTo={returnTo} />
      </div>
    </div>
  );
};

export default LoginMfaPage;

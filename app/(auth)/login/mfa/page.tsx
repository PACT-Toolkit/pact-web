import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { MfaChallengeForm } from '@/src/app/auth';

const MFA_TOKEN_COOKIE = 'pact_mfa_token';

// /login/mfa — second stage of password+TOTP sign-in.
//
// We treat the presence of the pact_mfa_token cookie as the only proof
// that the previous /api/auth/login call landed on the MFA branch. If
// it's missing (direct nav, refresh after success, TTL expired) we
// bounce the user back to /login rather than rendering a form that has
// nothing valid to submit. The route handler enforces the same check
// server-side, so this is purely a UX nicety.
const LoginMfaPage = async () => {
  const mfaToken = (await cookies()).get(MFA_TOKEN_COOKIE)?.value;
  if (!mfaToken) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <MfaChallengeForm />
      </div>
    </div>
  );
};

export default LoginMfaPage;

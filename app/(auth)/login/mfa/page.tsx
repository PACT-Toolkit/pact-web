import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthLoginMfaChallengeForm } from '@/src/app/auth';
import {
  MFA_TOKEN_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
} from '@/src/framework/auth/pact_auth/cookies';

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

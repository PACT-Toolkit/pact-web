import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AuthLoginMfaChallengeForm } from '@/src/app/auth';

const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const LoginMfaPage = async () => {
  const mfaToken = (await cookies()).get(MFA_TOKEN_COOKIE)?.value;
  if (!mfaToken) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AuthLoginMfaChallengeForm />
      </div>
    </div>
  );
};

export default LoginMfaPage;

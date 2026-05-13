import { DashboardPasskeyCTA } from '@/src/app/auth';
import { hasWebAuthnFactor } from '@/src/framework/auth/pact_auth/factors';

const DashboardPage = async () => {
  const hasWebauthn = await hasWebAuthnFactor();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {!hasWebauthn && <DashboardPasskeyCTA />}
    </main>
  );
};

export default DashboardPage;

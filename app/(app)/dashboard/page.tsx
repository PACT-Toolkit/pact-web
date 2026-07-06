import { AuthPasskeyDashboardCTA } from '@/src/app/auth';
import { DashboardConsole } from '@/src/app/dashboard';
import { hasWebAuthnFactor } from '@/src/framework/auth/pact_auth/factors';

const DashboardPage = async () => {
  const hasWebauthn = await hasWebAuthnFactor();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live pipeline console. Probe the filter chain, watch decisions as they
          land, and jump straight to the stage that needs attention.
        </p>
      </div>

      {!hasWebauthn && <AuthPasskeyDashboardCTA />}

      <DashboardConsole />
    </div>
  );
};

export default DashboardPage;

import { DashboardPasskeyCTA } from '@/src/app/auth';
import { hasWebAuthnFactor } from '@/src/framework/auth/pact_auth/factors';

const DashboardPage = async () => {
  // The page-level CTA is the "post-password-registration" nudge from the
  // spec: any user who lands on the dashboard without a passkey gets a
  // friendly card. The cross-app banner in (app)/layout.tsx covers the
  // ambient case; this card is louder and only appears on the home page.
  // Server-side check keeps the card off the wire entirely once a
  // passkey or WebAuthn MFA factor exists; the client component then
  // layers the "user dismissed it on this device" check on top.
  const hasWebauthn = await hasWebAuthnFactor();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {!hasWebauthn && <DashboardPasskeyCTA />}
    </main>
  );
};

export default DashboardPage;

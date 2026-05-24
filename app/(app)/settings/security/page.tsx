import { AuthSettingsSignInMethodsPanel } from '@/src/app/auth';
import {
  listIdentities,
  listMfaFactors,
  listPasskeys,
} from '@/src/framework/auth/pact_auth/factors';

const SecuritySettingsPage = async () => {
  const [factors, passkeys, identities] = await Promise.all([
    listMfaFactors(),
    listPasskeys(),
    listIdentities(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sign-in methods</h1>
        <p className="text-sm text-muted-foreground">
          Manage how you sign in to PACT. We recommend at least one passkey or a
          connected provider. Passwords on their own are the easiest thing to
          phish.
        </p>
      </header>

      <AuthSettingsSignInMethodsPanel
        factors={factors}
        passkeys={passkeys}
        identities={identities}
      />
    </main>
  );
};

export default SecuritySettingsPage;

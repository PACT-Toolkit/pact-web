import { LogoutButton, PasskeyEnrollmentBanner } from '@/src/app/auth';
import { hasWebAuthnFactor } from '@/src/framework/auth/pact_auth/factors';
import { requireSession } from '@/src/framework/auth/pact_auth/session';

// requireSession() is the real auth barrier — middleware only checks that
// a cookie exists, this is what verifies it. Every protected route lives
// under this layout, so adding new authenticated paths needs no extra
// wiring beyond placing them under app/(app)/.
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  await requireSession();
  // Tell the banner whether the account is already covered by a passkey or
  // a WebAuthn MFA factor so it stays hidden across devices, not just on
  // the device that performed the enrollment.
  const hasWebauthn = await hasWebAuthnFactor();

  return (
    <div className="flex min-h-screen flex-col">
      <PasskeyEnrollmentBanner hasPasskeyOrWebauthnMfa={hasWebauthn} />
      <div className="flex flex-1">
        {/* Sidebar will go here */}
        <div className="flex flex-1 flex-col">
          <header className="flex justify-end border-b px-6 py-3">
            <LogoutButton />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;

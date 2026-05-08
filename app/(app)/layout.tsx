import { LogoutButton } from '@/src/app/auth';
import { requireSession } from '@/src/framework/auth/pact_auth/session';

// requireSession() is the real auth barrier — middleware only checks that
// a cookie exists, this is what verifies it. Every protected route lives
// under this layout, so adding new authenticated paths needs no extra
// wiring beyond placing them under app/(app)/.
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  await requireSession();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar will go here */}
      <div className="flex flex-1 flex-col">
        <header className="flex justify-end border-b px-6 py-3">
          <LogoutButton />
        </header>
        {children}
      </div>
    </div>
  );
};

export default AppLayout;

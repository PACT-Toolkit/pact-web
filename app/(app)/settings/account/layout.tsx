import { AccountSettingsNav } from '@/src/app/account/ui/settings/AccountSettingsNav';

const AccountSettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8 lg:flex-row">
      <aside className="lg:w-64 lg:shrink-0">
        <header className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground">
            Profile and data-rights settings for the signed-in user.
          </p>
        </header>
        <AccountSettingsNav />
      </aside>
      <section className="flex-1 min-w-0">{children}</section>
    </main>
  );
};

export default AccountSettingsLayout;

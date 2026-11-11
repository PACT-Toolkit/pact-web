import { PageContainer } from '@/src/components/page-container';
import { SettingsNav } from '@/src/framework/settings/settings_nav';

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <PageContainer className="gap-8 lg:flex-row">
      <aside className="lg:w-64 lg:shrink-0">
        <header className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Profile, data rights and sign-in methods.
          </p>
        </header>
        <SettingsNav />
      </aside>
      <section className="flex-1 min-w-0">{children}</section>
    </PageContainer>
  );
};

export default SettingsLayout;

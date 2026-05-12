import { PasskeyEnrollmentBanner } from '@/src/app/auth';
import { AppSidebar } from '@/src/components/app-sidebar';
import { Separator } from '@/src/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/src/components/ui/sidebar';
import { hasWebAuthnFactor } from '@/src/framework/auth/pact_auth/factors';
import { requireSession } from '@/src/framework/auth/pact_auth/session';
import { ThemeToggle } from '@/src/framework/theme';

const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  await requireSession();
  const hasWebauthn = await hasWebAuthnFactor();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <PasskeyEnrollmentBanner hasPasskeyOrWebauthnMfa={hasWebauthn} />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;

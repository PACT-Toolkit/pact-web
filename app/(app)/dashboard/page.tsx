import { DashboardConsole } from '@/src/app/dashboard';
import { PageContainer } from '@/src/components/page-container';

const DashboardPage = () => (
  <PageContainer>
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Live pipeline console. Probe the filter chain, watch decisions as they
        land, and jump straight to the stage that needs attention.
      </p>
    </div>

    <DashboardConsole />
  </PageContainer>
);

export default DashboardPage;

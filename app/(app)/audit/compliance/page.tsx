import { AuditComplianceView } from '@/src/app/audit';
import { PageContainer } from '@/src/components/page-container';

const AuditCompliancePage = () => {
  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Compliance</h1>
        <p className="text-sm text-muted-foreground">
          How many decisions each compliance control covered, and a per-decision
          report you can hand to an auditor.
        </p>
      </header>
      <AuditComplianceView />
    </PageContainer>
  );
};

export default AuditCompliancePage;

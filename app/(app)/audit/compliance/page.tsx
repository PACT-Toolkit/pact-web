import { AuditComplianceView } from '@/src/app/audit';

const AuditCompliancePage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Compliance</h1>
        <p className="text-sm text-muted-foreground">
          How many decisions each compliance control covered, and a per-decision
          report you can hand to an auditor.
        </p>
      </header>
      <AuditComplianceView />
    </div>
  );
};

export default AuditCompliancePage;

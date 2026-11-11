import { AuditWorkbench } from '@/src/app/audit';
import { PageContainer } from '@/src/components/page-container';

const AuditPage = () => {
  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Every audit-relevant action recorded against your account. Rows are
          immutable -- pact-audit&apos;s database role has INSERT + SELECT only,
          so even support cannot edit or delete a row here.
        </p>
      </header>
      <AuditWorkbench />
    </PageContainer>
  );
};

export default AuditPage;

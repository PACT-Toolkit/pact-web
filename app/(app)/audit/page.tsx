import { AuditWorkbench } from '@/src/app/audit';

const AuditPage = () => {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Every audit-relevant action recorded against your account. Rows are
          immutable -- pact-audit&apos;s database role has INSERT + SELECT only,
          so even support cannot edit or delete a row here.
        </p>
      </header>
      <AuditWorkbench />
    </main>
  );
};

export default AuditPage;

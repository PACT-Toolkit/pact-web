import { RedactorTestPanel, RedactorWorkbench } from '@/src/app/redactor';
import { PageContainer } from '@/src/components/page-container';

const RedactorPage = () => (
  <PageContainer>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Redactor</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-redactor verdicts, plus an ad-hoc test panel to run
        text through the redaction stage directly.
      </p>
    </header>
    <RedactorTestPanel />
    <RedactorWorkbench />
  </PageContainer>
);

export default RedactorPage;

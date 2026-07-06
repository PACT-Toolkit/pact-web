import { RedactorTestPanel, RedactorWorkbench } from '@/src/app/redactor';

const RedactorPage = () => (
  <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Redactor</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-redactor verdicts, plus an ad-hoc test panel to run
        text through the redaction stage directly.
      </p>
    </header>
    <RedactorTestPanel />
    <RedactorWorkbench />
  </div>
);

export default RedactorPage;

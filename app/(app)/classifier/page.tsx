import { ClassifierTestPanel, ClassifierWorkbench } from '@/src/app/classifier';

const ClassifierPage = () => (
  <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Classifier</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-classifier verdicts: label, confidence score, engine,
        and whether consensus arbitrated the request. The ad-hoc test panel
        below runs pasted text through the classifier stage directly and can
        label the resulting verdict false positive or false negative.
      </p>
    </header>
    <ClassifierWorkbench />
    <ClassifierTestPanel />
  </main>
);

export default ClassifierPage;

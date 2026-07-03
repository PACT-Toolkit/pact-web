import { ClassifierWorkbench } from '@/src/app/classifier';

const ClassifierPage = () => (
  <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Classifier</h1>
      <p className="text-sm text-muted-foreground">
        Live view of pact-classifier verdicts: label, confidence score, engine,
        and whether consensus arbitrated the request.
      </p>
    </header>
    <ClassifierWorkbench />
  </main>
);

export default ClassifierPage;

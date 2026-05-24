import { TestLabWorkbench } from '@/src/app/test_lab';

const TestLabPage = () => (
  <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">Test lab</h1>
      <p className="text-sm text-muted-foreground">
        Manually probe the filter pipeline with prompt payloads and embedded file attacks.
      </p>
    </header>
    <TestLabWorkbench />
  </main>
);

export default TestLabPage;

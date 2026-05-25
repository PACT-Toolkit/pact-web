import { PolicyWorkbench } from '@/src/app/policy';

const PolicyPage = () => {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Policy</h1>
        <p className="text-sm text-muted-foreground">
          Requests evaluated against a capability token. Denied decisions
          mean the token did not authorize the requested agent or tool.
        </p>
      </header>
      <PolicyWorkbench />
    </main>
  );
};

export default PolicyPage;

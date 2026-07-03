import {
  PolicyEventsFeed,
  PolicyTokenIssuePanel,
  RuleEditor,
} from '@/src/app/policy';

const PolicyPage = () => {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Policy rules</h1>
          <p className="text-sm text-muted-foreground">
            Author capability-policy rules. New rules start as Drafts and are
            evaluated once published.
          </p>
        </header>
        <RuleEditor />
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Capability tokens</h2>
          <p className="text-sm text-muted-foreground">
            Mint a scoped, time-limited capability token for an agent and tool
            pair.
          </p>
        </header>
        <PolicyTokenIssuePanel />
      </section>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Decisions</h2>
          <p className="text-sm text-muted-foreground">
            Requests evaluated against a capability token. Denied decisions mean
            the token did not authorize the requested agent or tool.
          </p>
        </header>
        <PolicyEventsFeed />
      </section>
    </main>
  );
};

export default PolicyPage;

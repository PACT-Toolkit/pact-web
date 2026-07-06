import { ConsensusWorkbench } from '@/src/app/consensus';

const ConsensusPage = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Consensus</h1>
        <p className="text-sm text-muted-foreground">
          Operational view over consensus arbitration (pipeline stage 2.5) --
          per-model votes, agreement, and quorum for every request the
          classifier wasn&apos;t confident enough to resolve on its own.
        </p>
      </header>
      <ConsensusWorkbench />
    </div>
  );
};

export default ConsensusPage;

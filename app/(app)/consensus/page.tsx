import { ConsensusWorkbench } from '@/src/app/consensus';
import { PageContainer } from '@/src/components/page-container';

const ConsensusPage = () => {
  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Consensus</h1>
        <p className="text-sm text-muted-foreground">
          Operational view over consensus arbitration (pipeline stage 2.5) --
          per-model votes, agreement, and quorum for every request the
          classifier wasn&apos;t confident enough to resolve on its own.
        </p>
      </header>
      <ConsensusWorkbench />
    </PageContainer>
  );
};

export default ConsensusPage;

import Link from 'next/link';

import { BenchmarkRunRowsView } from '@/src/app/benchmark';
import { PageContainer } from '@/src/components/page-container';

interface BenchmarkRunPageProps {
  params: Promise<{ runId: string }>;
}

const BenchmarkRunPage = async ({ params }: BenchmarkRunPageProps) => {
  const { runId } = await params;

  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <Link
          href="/benchmark"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to benchmark
        </Link>
        <h1 className="text-2xl font-semibold">Run rows</h1>
        <p className="text-sm text-muted-foreground">
          Per-row verdicts of run <span className="font-mono">{runId}</span>.
        </p>
      </header>
      <BenchmarkRunRowsView runId={runId} />
    </PageContainer>
  );
};

export default BenchmarkRunPage;

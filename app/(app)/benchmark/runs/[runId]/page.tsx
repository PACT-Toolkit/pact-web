import Link from 'next/link';

import { BenchmarkRunRowsView } from '@/src/app/benchmark';

interface BenchmarkRunPageProps {
  params: Promise<{ runId: string }>;
}

const BenchmarkRunPage = async ({ params }: BenchmarkRunPageProps) => {
  const { runId } = await params;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-8">
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
    </div>
  );
};

export default BenchmarkRunPage;

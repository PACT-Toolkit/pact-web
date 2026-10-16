import Link from 'next/link';

import { benchmarkRunRowsHref } from '@/src/app/benchmark/domain/benchmark_run_rows';

interface BenchmarkRunRowsLinkProps {
  /** The persisted run the finished job produced; absent or empty when the
   * gateway predates the field or persisting the run failed. */
  runId: string | undefined;
}

/**
 * Link from a finished job's summary to the rows view of the run it
 * persisted. Renders nothing without a run id, since there is no page to
 * open for a run that was never stored.
 */
export const BenchmarkRunRowsLink = ({ runId }: BenchmarkRunRowsLinkProps) => {
  if (!runId) return null;

  return (
    <div className="flex justify-end">
      <Link
        href={benchmarkRunRowsHref(runId)}
        className="text-sm font-medium underline-offset-4 hover:underline"
        data-testid="benchmark-run-rows-link"
      >
        View rows
      </Link>
    </div>
  );
};

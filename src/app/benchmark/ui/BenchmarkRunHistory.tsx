'use client';

import Link from 'next/link';

import { type TrendDateRange } from '@/src/app/benchmark/domain/benchmark_run';
import { formatRunTimestamp } from '@/src/app/benchmark/domain/benchmark_trend';
import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';
import { formatPercent } from '@/src/framework/format/format_percent';

/** Most recent runs listed; the range toggle narrows or widens the pool. */
const RUN_HISTORY_LIMIT = 20;

interface BenchmarkRunHistoryProps {
  dateRange: TrendDateRange;
}

export const BenchmarkRunHistory = ({
  dateRange,
}: BenchmarkRunHistoryProps) => {
  const { runs, isLoading, error } = useBenchmarkRuns(dateRange);

  // The hook sorts ascending for the charts; the history lists newest first.
  const newest = [...runs].reverse();
  const shown = newest.slice(0, RUN_HISTORY_LIMIT);

  return (
    <Card data-testid="benchmark-run-history">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Run history</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && runs.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : error ? (
          <div className="flex h-24 items-center justify-center text-sm text-destructive">
            Failed to load benchmark runs.
          </div>
        ) : runs.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No benchmark runs in this range.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2 font-medium">
                      Ran at
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Engine
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Corpus
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Rows
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Detection
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      FP
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Unscored
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Run rows</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((run) => (
                    <tr
                      key={run.id}
                      data-testid="benchmark-run-history-row"
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatRunTimestamp(run.ran_at)}
                      </td>
                      <td
                        className="max-w-56 truncate px-3 py-2"
                        title={run.engine}
                      >
                        {run.engine || '-'}
                      </td>
                      <td
                        className="max-w-48 truncate px-3 py-2 text-muted-foreground"
                        title={run.corpus_version}
                      >
                        {abbreviateHash(run.corpus_version)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {run.row_count}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPercent(run.detection_rate, { digits: 1 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPercent(run.fp_rate, { digits: 1 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {run.counts?.unscored ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/benchmark/runs/${encodeURIComponent(run.id)}`}
                          className="text-sm font-medium underline-offset-4 hover:underline"
                          aria-label={`View rows of the ${run.engine} run from ${formatRunTimestamp(run.ran_at)}`}
                        >
                          Rows
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {newest.length > RUN_HISTORY_LIMIT && (
              <p className="text-xs text-muted-foreground">
                Showing {RUN_HISTORY_LIMIT} of {newest.length} runs
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

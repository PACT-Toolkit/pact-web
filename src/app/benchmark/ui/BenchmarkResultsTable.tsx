'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useGetBenchmarkJob } from '@/src/__codegen__/rest/benchmark';
import {
  isRowCorrect,
  type RowResult,
} from '@/src/app/benchmark/domain/benchmark_job';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

const PAGE_SIZE = 20;

interface BenchmarkResultsTableProps {
  jobId: string;
  totalRows: number;
}

export const BenchmarkResultsTable = ({
  jobId,
  totalRows,
}: BenchmarkResultsTableProps) => {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const params = useMemo(() => ({ offset, limit: PAGE_SIZE }), [offset]);

  const { data, isLoading } = useGetBenchmarkJob(jobId, params, {
    swr: { revalidateOnFocus: false, keepPreviousData: true },
  });

  const rows = data?.status === 200 ? (data.data.result?.rows ?? []) : [];
  const pageCount = Math.ceil(totalRows / PAGE_SIZE);
  const from = offset + 1;
  const to = Math.min(offset + PAGE_SIZE, totalRows);

  const titleId = `bench-table-title-${jobId}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle id={titleId} className="text-base">
          Per-row verdicts
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {totalRows > 0 ? `${from}–${to} of ${totalRows}` : '0 rows'}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 p-0">
        <div className="overflow-x-auto">
          <table aria-labelledby={titleId} className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  Expected
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Decision
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Correct
                </th>
                <th scope="col" className="px-4 py-2 font-medium tabular-nums">
                  Latency (ms)
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : !isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    No rows returned.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <BenchmarkResultRow key={row.row_id} row={row} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <nav
            aria-label="Table pagination"
            className="flex items-center justify-end gap-2 border-t px-4 py-2"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="text-xs text-muted-foreground"
            >
              {page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </CardContent>
    </Card>
  );
};

const BenchmarkResultRow = ({ row }: { row: RowResult }) => {
  const correct = isRowCorrect(row);
  const hasError = Boolean(row.error);

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="px-4 py-2">
        <VerdictLabel text={row.expected_label} />
      </td>
      <td className="px-4 py-2">
        {hasError ? (
          <span className="text-xs text-destructive">error</span>
        ) : (
          <VerdictLabel text={row.decision ?? '—'} />
        )}
      </td>
      <td className="px-4 py-2">
        {hasError ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span
            aria-label={correct ? 'Correct' : 'Incorrect'}
            className={
              correct
                ? 'text-green-600 dark:text-green-400'
                : 'text-destructive'
            }
          >
            {correct ? '✓' : '✗'}
          </span>
        )}
      </td>
      <td className="px-4 py-2 tabular-nums text-muted-foreground">
        {row.latency_ms?.toFixed(1) ?? '—'}
      </td>
    </tr>
  );
};

const VerdictLabel = ({ text }: { text: string }) => (
  <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
    {text}
  </span>
);

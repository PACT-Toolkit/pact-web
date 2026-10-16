'use client';

import { useMemo, useState } from 'react';

import { useGetBenchmarkJob } from '@/src/__codegen__/rest/benchmark';
import {
  isRowCorrect,
  type RowResult,
} from '@/src/app/benchmark/domain/benchmark_job';
import { rowVerdictKind } from '@/src/app/benchmark/domain/benchmark_run_rows';
import { BenchmarkTablePagination } from '@/src/app/benchmark/ui/BenchmarkTablePagination';
import { BenchmarkVerdictCell } from '@/src/app/benchmark/ui/BenchmarkVerdictCell';
import { BenchmarkVerdictChip } from '@/src/app/benchmark/ui/BenchmarkVerdictChip';
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
          {totalRows > 0 ? `${from}-${to} of ${totalRows}` : '0 rows'}
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
                <th scope="col" className="px-4 py-2 font-medium">
                  Error
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              ) : !isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
          <BenchmarkTablePagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        )}
      </CardContent>
    </Card>
  );
};

const BenchmarkResultRow = ({ row }: { row: RowResult }) => {
  const correct = isRowCorrect(row);
  // Only a row with a real verdict is judged correct or incorrect.
  const hasVerdict = rowVerdictKind(row) === 'verdict';

  return (
    <tr className="border-b last:border-0 hover:bg-muted/40">
      <td className="px-4 py-2">
        <BenchmarkVerdictChip text={row.expected_label} />
      </td>
      <td className="px-4 py-2">
        <BenchmarkVerdictCell row={row} />
      </td>
      <td className="px-4 py-2">
        {hasVerdict ? (
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
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-4 py-2 tabular-nums text-muted-foreground">
        {row.latency_ms?.toFixed(1) ?? '-'}
      </td>
      <td
        className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground"
        title={row.error}
      >
        {row.error}
      </td>
    </tr>
  );
};

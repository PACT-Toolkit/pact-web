'use client';

import { useId, useMemo, useState } from 'react';

import {
  RUN_ROW_OUTCOME_ALL,
  RUN_ROW_OUTCOMES,
  RUN_ROWS_PAGE_SIZE,
  type BenchmarkRunRow,
} from '@/src/app/benchmark/domain/benchmark_run_rows';
import { formatRunTimestamp } from '@/src/app/benchmark/domain/benchmark_trend';
import { useBenchmarkRunRows } from '@/src/app/benchmark/domain/use_benchmark_run_rows';
import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import { BenchmarkTablePagination } from '@/src/app/benchmark/ui/BenchmarkTablePagination';
import { BenchmarkVerdictCell } from '@/src/app/benchmark/ui/BenchmarkVerdictCell';
import { BenchmarkVerdictChip } from '@/src/app/benchmark/ui/BenchmarkVerdictChip';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';
import { cn } from '@/src/lib/utils';

const COLUMN_COUNT = 8;

interface BenchmarkRunRowsViewProps {
  runId: string;
}

export const BenchmarkRunRowsView = ({ runId }: BenchmarkRunRowsViewProps) => {
  const categoryListId = useId();
  const outcomeLabelId = useId();
  const [page, setPage] = useState(0);
  const [outcome, setOutcome] = useState(RUN_ROW_OUTCOME_ALL);
  const [category, setCategory] = useState('');
  const offset = page * RUN_ROWS_PAGE_SIZE;

  const { rows, total, isLoading, error, notFound } = useBenchmarkRunRows(
    runId,
    { offset, category, outcome }
  );

  // There is no single-run endpoint: find the run in the full run list.
  const { runs, isLoading: isRunsLoading } = useBenchmarkRuns('all');
  const run = useMemo(() => runs.find((r) => r.id === runId), [runs, runId]);
  const categories = run?.per_category?.map((c) => c.category) ?? [];

  const pageCount = Math.ceil(total / RUN_ROWS_PAGE_SIZE);
  const from = offset + 1;
  const to = Math.min(offset + RUN_ROWS_PAGE_SIZE, total);

  // Any filter change goes back to the first page.
  const changeOutcome = (value: string) => {
    setOutcome(value);
    setPage(0);
  };
  const changeCategory = (value: string) => {
    setCategory(value);
    setPage(0);
  };

  if (notFound) {
    return (
      <Card data-testid="benchmark-run-rows">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Run not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="benchmark-run-rows">
      <CardHeader className="flex flex-col gap-1 pb-2">
        <div className="flex w-full flex-row items-center justify-between">
          <CardTitle className="text-base">Per-row verdicts</CardTitle>
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `${from}-${to} of ${total}` : '0 rows'}
          </span>
        </div>
        <p
          className="truncate text-xs text-muted-foreground"
          title={run?.engine}
        >
          {run
            ? `${run.engine} · ${abbreviateHash(run.corpus_version)} · ${formatRunTimestamp(run.ran_at)} · ${run.row_count} rows · ${run.counts?.unscored ?? 0} unscored`
            : isRunsLoading
              ? 'Loading run metadata…'
              : 'Run metadata unavailable'}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-0 p-0">
        <div className="flex flex-wrap items-end gap-4 border-b px-4 pb-3">
          <div className="flex flex-col gap-1">
            <span
              id={outcomeLabelId}
              className="text-xs font-medium text-muted-foreground"
            >
              Outcome
            </span>
            <Select value={outcome} onValueChange={changeOutcome}>
              <SelectTrigger
                data-testid="benchmark-run-rows-outcome"
                aria-labelledby={outcomeLabelId}
                className="w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RUN_ROW_OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Category
            </span>
            <Input
              data-testid="benchmark-run-rows-category"
              list={categoryListId}
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
              placeholder="All categories"
              className="w-56"
            />
            <datalist id={categoryListId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Run rows">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  #
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Expected
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Decision
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Reason
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Layer
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Rule
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Classifier
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Latency (ms)
                </th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <MessageRow className="text-destructive">
                  Failed to load rows.
                </MessageRow>
              ) : isLoading && rows.length === 0 ? (
                <MessageRow>Loading…</MessageRow>
              ) : rows.length === 0 ? (
                <MessageRow>No rows match.</MessageRow>
              ) : (
                rows.map((row) => (
                  <BenchmarkRunRowLine key={row.row_id} row={row} />
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

const MessageRow = ({
  children,
  className,
}: {
  children: string;
  className?: string;
}) => (
  <tr>
    <td
      colSpan={COLUMN_COUNT}
      className={cn(
        'px-4 py-6 text-center text-sm text-muted-foreground',
        className
      )}
    >
      {children}
    </td>
  </tr>
);

const classifierText = (row: BenchmarkRunRow): string => {
  const label = row.classifier_label;
  if (label && row.classifier_score !== undefined) {
    return `${label} ${row.classifier_score.toFixed(2)}`;
  }

  return label || '-';
};

const BenchmarkRunRowLine = ({ row }: { row: BenchmarkRunRow }) => (
  <tr
    data-testid="benchmark-run-rows-row"
    className="border-b last:border-0 hover:bg-muted/40"
  >
    <td className="px-4 py-2 tabular-nums text-muted-foreground">
      {row.seq ?? '-'}
    </td>
    <td className="px-4 py-2">
      <BenchmarkVerdictChip text={row.expected_label} />
    </td>
    <td className="px-4 py-2">
      <BenchmarkVerdictCell row={row} />
    </td>
    <td
      className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground"
      title={row.reason}
    >
      {row.reason || '-'}
    </td>
    <td className="px-4 py-2 text-xs">{row.decisive_layer || '-'}</td>
    <td className="px-4 py-2 font-mono text-xs">{row.filter_rule_id || '-'}</td>
    <td className="px-4 py-2 text-xs tabular-nums">{classifierText(row)}</td>
    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
      {row.latency_ms.toFixed(1)}
    </td>
  </tr>
);

'use client';

import { formatCorpusRowCount } from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { type CorpusCompositionRow } from '@/src/app/benchmark/domain/corpus_composition';
import { BenchmarkCorpusRoleBadge } from '@/src/app/benchmark/ui/BenchmarkCorpusRoleBadge';

interface BenchmarkCorpusCompositionChartProps {
  rows: readonly CorpusCompositionRow[];
}

/**
 * One horizontal 100%-stacked bar per dataset (block share vs allow share),
 * replacing the corpus-library card's former table. Chosen over an absolute
 * stacked bar or a log axis: an absolute bar on a linear axis flattens every
 * dataset under 10k rows next to the 377k-row outlier, and a log axis cannot
 * stack. Percent share is comparable across datasets of any size; the
 * absolute row count and role stay visible at the row's end so no
 * information the old table showed is lost.
 */
export const BenchmarkCorpusCompositionChart = ({
  rows,
}: BenchmarkCorpusCompositionChartProps) => (
  <div data-testid="benchmark-corpus-composition-chart">
    <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-3 rounded-sm"
          style={{ backgroundColor: 'var(--chart-2)' }}
        />
        Block
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-3 rounded-sm"
          style={{ backgroundColor: 'var(--chart-1)' }}
        />
        Allow
      </span>
    </div>

    <div className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.source_dataset}
          data-testid="benchmark-corpus-composition-row"
          className="flex flex-col gap-2 border-b py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
        >
          <div className="min-w-0 sm:w-64 sm:flex-none">
            <p className="truncate font-mono text-xs">{row.source_dataset}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.category} · {row.license}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div
              data-testid="benchmark-corpus-composition-bar"
              role="img"
              aria-label={`${row.source_dataset}: ${row.blockPercent}% block, ${row.allowPercent}% allow`}
              className="flex h-2 w-full overflow-hidden rounded-sm bg-muted"
            >
              <div
                style={{
                  width: `${row.blockPercent}%`,
                  backgroundColor: 'var(--chart-2)',
                }}
              />
              <div
                style={{
                  width: `${row.allowPercent}%`,
                  backgroundColor: 'var(--chart-1)',
                }}
              />
            </div>
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {formatCorpusRowCount(row.block_rows)} block /{' '}
              {formatCorpusRowCount(row.allow_rows)} allow
            </p>
          </div>

          <div className="flex flex-none items-center justify-between gap-2 sm:justify-end">
            <span className="text-sm tabular-nums">
              {formatCorpusRowCount(row.total_rows)}
            </span>
            <BenchmarkCorpusRoleBadge role={row.role} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

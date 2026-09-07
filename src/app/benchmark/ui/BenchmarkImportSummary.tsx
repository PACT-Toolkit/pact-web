import { type HubImportSummary } from '@/src/app/benchmark/domain/benchmark_import';
import { StatTile } from '@/src/framework/components/stat_tile';

interface BenchmarkImportSummaryProps {
  summary: HubImportSummary;
}

/**
 * The hub-import breakdown for a job started from `BenchmarkImportCard`,
 * shown above the confusion tiles when the job's `hub_import` field is set.
 * Distinct from `BenchmarkConfusionTiles`, which derives correctness from
 * the gateway's own verdicts - this reports what the import pipeline did to
 * the source dataset before any row ever reached the gateway (how many rows
 * it read, dropped as blank/skip-mapped, or excluded because they were
 * already trained on).
 */
export const BenchmarkImportSummary = ({
  summary,
}: BenchmarkImportSummaryProps) => (
  <div
    className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    data-testid="benchmark-import-summary"
  >
    <StatTile
      label="Dataset"
      value={summary.slug}
      size="sm"
      testId="benchmark-import-summary-slug"
    />
    <StatTile
      label="Rows read"
      value={summary.rows_read}
      size="sm"
      testId="benchmark-import-summary-rows-read"
    />
    <StatTile
      label="Attack rows"
      value={summary.attack_rows}
      size="sm"
      testId="benchmark-import-summary-attack-rows"
    />
    <StatTile
      label="Benign rows"
      value={summary.benign_rows}
      size="sm"
      testId="benchmark-import-summary-benign-rows"
    />
    <StatTile
      label="Rows skipped"
      value={summary.rows_skipped}
      size="sm"
      testId="benchmark-import-summary-rows-skipped"
    />
    <StatTile
      label="Excluded (trained on)"
      value={summary.rows_excluded_trained_on}
      size="sm"
      testId="benchmark-import-summary-rows-excluded"
    />
    <StatTile
      label="Screened"
      value={summary.screened ? 'Yes' : 'No'}
      size="sm"
      testId="benchmark-import-summary-screened"
    />
    <StatTile
      label="Truncated"
      value={summary.truncated ? 'Yes' : 'No'}
      valueClass={summary.truncated ? 'text-warning' : undefined}
      size="sm"
      testId="benchmark-import-summary-truncated"
    />
  </div>
);

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { deriveConfusionCounts } from '@/src/app/benchmark/domain/benchmark_confusion';
import { StatTile } from '@/src/framework/components/stat_tile';

interface BenchmarkConfusionTilesProps {
  counts: RunCounts | undefined;
}

/**
 * The confusion matrix for a finished job, derived from its `counts`
 * breakdown. Renders nothing when the job predates the breakdown (see
 * benchmark_breakdown.ts) - there is nothing correct to show instead of a
 * matrix of zeros that would misreport an unmeasured job as "no attacks
 * missed."
 */
export const BenchmarkConfusionTiles = ({
  counts,
}: BenchmarkConfusionTilesProps) => {
  if (!counts) return null;

  const confusion = deriveConfusionCounts(counts);

  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-5"
      data-testid="benchmark-confusion-tiles"
    >
      <StatTile
        label="True positives"
        value={confusion.truePositives}
        testId="benchmark-confusion-tp"
      />
      <StatTile
        label="False negatives"
        value={confusion.falseNegatives}
        valueClass={
          confusion.falseNegatives > 0 ? 'text-destructive' : undefined
        }
        testId="benchmark-confusion-fn"
      />
      <StatTile
        label="False positives"
        value={confusion.falsePositives}
        valueClass={
          confusion.falsePositives > 0 ? 'text-destructive' : undefined
        }
        testId="benchmark-confusion-fp"
      />
      <StatTile
        label="True negatives"
        value={confusion.trueNegatives}
        testId="benchmark-confusion-tn"
      />
      <StatTile
        label="Errors"
        value={confusion.errors}
        valueClass={confusion.errors > 0 ? 'text-destructive' : undefined}
        testId="benchmark-confusion-errors"
      />
    </div>
  );
};

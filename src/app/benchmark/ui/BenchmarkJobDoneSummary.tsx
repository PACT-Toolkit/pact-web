import { type JobResult } from '@/src/app/benchmark/domain/benchmark_job';
import { jobHeadlineStats } from '@/src/app/benchmark/domain/benchmark_job_summary';
import { BenchmarkConfusionTiles } from '@/src/app/benchmark/ui/BenchmarkConfusionTiles';
import { BenchmarkRunRowsLink } from '@/src/app/benchmark/ui/BenchmarkRunRowsLink';
import { StatTile } from '@/src/framework/components/stat_tile';

interface BenchmarkJobDoneSummaryProps {
  result: JobResult;
}

/**
 * The one summary of a finished benchmark job: the headline rates and
 * latencies, the confusion matrix behind them, and the link to the run's
 * persisted rows. The confusion tiles and the rows link each render nothing
 * when the job lacks the data (a job persisted before the counts breakdown,
 * or one whose run was never stored), so the summary degrades to whatever the
 * job actually measured.
 */
export const BenchmarkJobDoneSummary = ({
  result,
}: BenchmarkJobDoneSummaryProps) => (
  <div className="flex flex-col gap-4" data-testid="benchmark-job-done-summary">
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
      data-testid="benchmark-job-headline-stats"
    >
      {jobHeadlineStats(result).map((stat) => (
        <StatTile
          key={stat.key}
          label={stat.label}
          value={stat.value}
          testId={`benchmark-job-stat-${stat.key}`}
        />
      ))}
    </div>
    <BenchmarkConfusionTiles counts={result.counts} />
    <BenchmarkRunRowsLink runId={result.run_id} />
  </div>
);

import { type BenchmarkAdaptiveCampaignBody } from '@/src/__codegen__/rest/benchmark';
import {
  campaignProgressPct,
  campaignStatusTone,
  isCampaignRunning,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import { BenchmarkAdaptiveGoalsTable } from '@/src/app/benchmark/ui/BenchmarkAdaptiveGoalsTable';
import { BenchmarkAdaptiveResult } from '@/src/app/benchmark/ui/BenchmarkAdaptiveResult';
import { BenchmarkAdaptiveStatusBadge } from '@/src/app/benchmark/ui/BenchmarkAdaptiveStatusBadge';
import { cn } from '@/src/lib/utils';

interface BenchmarkAdaptiveCampaignViewProps {
  campaign: BenchmarkAdaptiveCampaignBody;
  onOpenGoal: (goalId: string) => void;
}

export const BenchmarkAdaptiveCampaignView = ({
  campaign,
  onOpenGoal,
}: BenchmarkAdaptiveCampaignViewProps) => {
  const running = isCampaignRunning(campaign.status);
  const progressPct = campaignProgressPct(campaign);
  const failed = campaignStatusTone(campaign.status) === 'danger';

  return (
    <div className="flex flex-col gap-4" data-testid="benchmark-adaptive-view">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <BenchmarkAdaptiveStatusBadge status={campaign.status} />
        <span className="text-sm text-muted-foreground tabular-nums">
          {campaign.goals_done} / {campaign.goals_total} goals
        </span>
      </div>

      {(running || campaign.status === 'interrupted' || failed) && (
        <div
          role="progressbar"
          aria-label="Campaign progress"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none',
              running ? 'bg-primary' : failed ? 'bg-destructive' : 'bg-warning'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {campaign.error && (
        <p
          role="alert"
          data-testid="benchmark-adaptive-error"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm break-words whitespace-pre-line text-destructive"
        >
          {campaign.error}
        </p>
      )}

      {campaign.result && <BenchmarkAdaptiveResult result={campaign.result} />}

      {campaign.goals.length > 0 ? (
        <BenchmarkAdaptiveGoalsTable
          goals={campaign.goals}
          onOpenGoal={onOpenGoal}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {running
            ? 'No goal has finished yet.'
            : 'No goals were recorded for this campaign.'}
        </p>
      )}
    </div>
  );
};

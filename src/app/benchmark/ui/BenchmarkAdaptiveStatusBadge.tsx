import {
  campaignStatusTone,
  type CampaignStatusTone,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import { cn } from '@/src/lib/utils';

const TONE_CLASS: Record<CampaignStatusTone, string> = {
  active: 'bg-primary/10 text-primary',
  success: 'bg-positive/15 text-positive',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

interface BenchmarkAdaptiveStatusBadgeProps {
  status: string;
}

/** Status of an adaptive campaign; interrupted and failed ones stand out. */
export const BenchmarkAdaptiveStatusBadge = ({
  status,
}: BenchmarkAdaptiveStatusBadgeProps) => (
  <span
    data-testid="benchmark-adaptive-status"
    data-status={status}
    className={cn(
      'rounded-sm px-1.5 py-0.5 font-mono text-xs',
      TONE_CLASS[campaignStatusTone(status)]
    )}
  >
    {status}
  </span>
);

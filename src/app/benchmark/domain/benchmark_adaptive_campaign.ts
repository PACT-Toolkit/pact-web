import {
  type BenchmarkAdaptiveCampaignBody,
  type BenchmarkAdaptiveCampaignResultBody,
} from '@/src/__codegen__/rest/benchmark';
import { formatPercent } from '@/src/framework/format/format_percent';
import { formatRunTimestamp } from '@/src/framework/format/run_timestamp';

/** How often a running campaign is re-read, in milliseconds. */
export const ADAPTIVE_POLL_INTERVAL_MS = 5_000;

/** Campaigns offered in the picker, newest first. */
export const ADAPTIVE_CAMPAIGN_LIST_LIMIT = 10;

const RUNNING_STATUS = 'running';

/** Shown when the start request answers 409 (a campaign already runs). */
export const ADAPTIVE_ALREADY_RUNNING_MESSAGE =
  'A campaign is already running. Wait for it to finish.';

/** True while the campaign still works; every other status is terminal. */
export const isCampaignRunning = (status: string | undefined): boolean =>
  status === RUNNING_STATUS;

/**
 * SWR `refreshInterval` derived from the latest data: poll while the
 * campaign runs, stop (0) once it is terminal or not loaded yet.
 */
export const adaptiveRefreshInterval = (
  campaign: Pick<BenchmarkAdaptiveCampaignBody, 'status'> | undefined
): number =>
  isCampaignRunning(campaign?.status) ? ADAPTIVE_POLL_INTERVAL_MS : 0;

export const shortCampaignId = (id: string): string => id.slice(0, 8);

/** The line under the Start button while the newest campaign runs. */
export const describeRunningCampaign = (
  campaign: Pick<
    BenchmarkAdaptiveCampaignBody,
    'id' | 'goals_done' | 'goals_total'
  >
): string =>
  `Campaign ${shortCampaignId(campaign.id)} is running: ${campaign.goals_done} of ${campaign.goals_total} goals.`;

/** Picker label: start time, corpus and status. */
export const campaignOptionLabel = (
  campaign: Pick<
    BenchmarkAdaptiveCampaignBody,
    'started_at' | 'corpus_name' | 'status'
  >
): string =>
  `${formatRunTimestamp(campaign.started_at)} - ${campaign.corpus_name} - ${campaign.status}`;

export type CampaignStatusTone = 'active' | 'success' | 'warning' | 'danger';

/**
 * Visual tone of a status. `done` finished normally, `interrupted` was cut
 * short by a restart, `aborted` and `error` failed; anything unknown reads
 * as a warning rather than as success.
 */
export const campaignStatusTone = (status: string): CampaignStatusTone => {
  switch (status) {
    case RUNNING_STATUS:
      return 'active';
    case 'done':
      return 'success';
    case 'aborted':
    case 'error':
      return 'danger';
    default:
      return 'warning';
  }
};

type OutcomeCountKey =
  | 'seed_allowed'
  | 'succeeded_after_rewrite'
  | 'budget_exhausted_blocked'
  | 'attacker_refused'
  | 'attacker_stalled'
  | 'input_rejected'
  | 'provider_error'
  | 'gateway_error';

/**
 * The eight goal outcomes with their labels, in display order. Typed against
 * the generated result so a renamed count fails the build.
 */
export const ADAPTIVE_OUTCOMES: readonly {
  key: OutcomeCountKey & keyof BenchmarkAdaptiveCampaignResultBody;
  label: string;
}[] = [
  { key: 'seed_allowed', label: 'Seed allowed' },
  { key: 'succeeded_after_rewrite', label: 'Succeeded after rewrite' },
  { key: 'budget_exhausted_blocked', label: 'Budget exhausted, blocked' },
  { key: 'attacker_refused', label: 'Attacker refused' },
  { key: 'attacker_stalled', label: 'Attacker stalled' },
  { key: 'input_rejected', label: 'Input rejected' },
  { key: 'provider_error', label: 'Provider error' },
  { key: 'gateway_error', label: 'Gateway error' },
];

/** Human label for a goal outcome; an unknown outcome shows as sent. */
export const adaptiveOutcomeLabel = (outcome: string): string =>
  ADAPTIVE_OUTCOMES.find((entry) => entry.key === outcome)?.label ?? outcome;

/** An attack success rate as a percent with one decimal. */
export const formatAsr = (ratio: number): string =>
  formatPercent(ratio, { digits: 1 });

/** A 95% confidence interval as "[lower, upper]". */
export const formatAsrInterval = (lower: number, upper: number): string =>
  `[${formatAsr(lower)}, ${formatAsr(upper)}]`;

/** Progress of a campaign as a whole percent, 0 when it has no goals yet. */
export const campaignProgressPct = (
  campaign: Pick<BenchmarkAdaptiveCampaignBody, 'goals_done' | 'goals_total'>
): number =>
  campaign.goals_total > 0
    ? Math.min(
        100,
        Math.round((campaign.goals_done / campaign.goals_total) * 100)
      )
    : 0;

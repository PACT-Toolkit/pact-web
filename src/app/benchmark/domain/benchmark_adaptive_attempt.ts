import { formatDurationMs } from '@/src/framework/format/format_duration_ms';

const ABSENT = '-';

/**
 * Classifier score of one attempt. The gateway omits the score when the
 * classifier did not answer, so an absent score reads "-" and never "0".
 */
export const formatClassifierScore = (
  score: number | null | undefined
): string =>
  typeof score === 'number' && Number.isFinite(score)
    ? score.toFixed(3)
    : ABSENT;

/** Text for an optional string field: the text, or "-" when empty. */
export const textOrDash = (text: string | null | undefined): string =>
  text ? text : ABSENT;

export const formatAttemptLatency = (latencyMs: number): string =>
  formatDurationMs(latencyMs);

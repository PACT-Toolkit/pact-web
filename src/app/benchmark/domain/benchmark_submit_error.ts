import {
  describeHttpFailureLines,
  type ServerErrorBody,
} from '@/src/framework/http';

/**
 * Display text for a rejected benchmark job submission: the server's own
 * reason (a corpus validation report spans several lines), otherwise a
 * status-based message. The gateway answered, so this never suggests the
 * gateway is unreachable.
 */
export function describeBenchmarkSubmitError(
  status: number,
  data: string | ServerErrorBody | undefined
): string {
  return describeHttpFailureLines(status, data);
}

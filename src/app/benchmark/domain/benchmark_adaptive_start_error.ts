import { ADAPTIVE_ALREADY_RUNNING_MESSAGE } from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';
import {
  describeHttpFailure,
  type ServerErrorBody,
} from '@/src/framework/http';

const CONFLICT_STATUS = 409;

/**
 * Display text for a rejected campaign start. 409 gets a fixed message; every
 * other status shows the server's own reason (a 400 carries "no attacker
 * configured" or a corpus refusal) or a status-based fallback.
 */
export const describeAdaptiveStartError = (
  status: number,
  data: string | ServerErrorBody | undefined
): string =>
  status === CONFLICT_STATUS
    ? ADAPTIVE_ALREADY_RUNNING_MESSAGE
    : describeHttpFailure(status, data);

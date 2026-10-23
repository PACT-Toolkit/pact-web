/**
 * Timing fields a gateway stage sub-object carries. `duration_us` (integer
 * microseconds, floored to 1 for any stage that ran) is the source of truth;
 * `duration_ms` is the deprecated whole-millisecond twin, omitted by the
 * gateway when it truncates to 0.
 */
export type StageTiming = { duration_ms?: number; duration_us?: number };

export const MICROSECONDS_PER_MILLISECOND = 1000;

const usableDuration = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

/**
 * Wall-clock milliseconds (fractional) a stage took. `duration_us` wins;
 * `duration_ms` is read only when `duration_us` is absent, i.e. on events
 * produced before the microsecond field existed. Only a finite number above
 * zero counts: absent and zero both mean "no timing to show".
 */
export const stageDurationMs = (
  timing: StageTiming | undefined
): number | undefined => {
  if (timing?.duration_us !== undefined) {
    const us = usableDuration(timing.duration_us);

    return us === undefined ? undefined : us / MICROSECONDS_PER_MILLISECOND;
  }

  return usableDuration(timing?.duration_ms);
};

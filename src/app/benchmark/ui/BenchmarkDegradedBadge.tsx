import { DEGRADED_TOOLTIP } from '@/src/app/benchmark/domain/benchmark_degraded';

/**
 * Small warning-tone badge on a benchmark run whose rows were lost to errors,
 * unscored verdicts or throttling past the run's threshold, so its rates are
 * less reliable. Same shape as the mitigated badge. The tooltip never names
 * the threshold: the benchmark service decides the flag.
 */
export const BenchmarkDegradedBadge = () => (
  <span
    data-testid="benchmark-degraded-badge"
    title={DEGRADED_TOOLTIP}
    className="rounded-sm bg-warning/15 px-1.5 py-0.5 font-mono text-xs text-warning"
  >
    degraded
  </span>
);

import { type CategoryBreakdown } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { roundToOneDecimalPercent } from '@/src/framework/format/round_percent';
import {
  wilsonInterval,
  type WilsonInterval,
} from '@/src/framework/stats/wilson_interval';

/** A 95% Wilson interval in percent, rounded to one decimal. */
export interface CategoryChartInterval {
  low: number;
  high: number;
}

function percentInterval(interval: WilsonInterval): CategoryChartInterval {
  return {
    low: roundToOneDecimalPercent(interval.low),
    high: roundToOneDecimalPercent(interval.high),
  };
}

/**
 * A `recharts` `ErrorBar` asymmetric offset pair: `[belowValue, aboveValue]`,
 * both non-negative, relative to the bar's own value - see ErrorBar's own
 * doc comment ("what ErrorBar will render is [value - errorVal[0], value +
 * errorVal[1]]").
 */
function errorOffsetFromInterval(
  rate: number,
  interval: CategoryChartInterval
): [number, number] {
  return [Math.max(0, rate - interval.low), Math.max(0, interval.high - rate)];
}

/**
 * Series config for the per-category chart's two bars. Same categorical
 * colors as `TREND_SERIES` (detection = chart-1, FP = chart-2) so the color
 * -> metric mapping stays consistent across every benchmark chart on the
 * page, even though the field names differ (camelCase domain fields here vs
 * the wire's snake_case on the trend chart's points).
 */
export const CATEGORY_SERIES: Record<
  'detectionRate' | 'fpRate',
  { label: string; color: string }
> = {
  detectionRate: { label: 'Detection rate', color: 'var(--chart-1)' },
  fpRate: { label: 'FP rate', color: 'var(--chart-2)' },
};

/** One horizontal-bar group on the per-category chart. */
export interface CategoryChartPoint {
  category: string;
  /**
   * Percent, rounded to one decimal. `null` when the category has no attack
   * rows (the rate is undefined, which is not the same as a 0% rate).
   */
  detectionRate: number | null;
  /** Error-bar offsets for `detectionRate`; `null` exactly when the rate is. */
  detectionErrorOffset: [number, number] | null;
  /** 95% Wilson bounds for `detectionRate` in percent; `null` exactly when the rate is. */
  detectionInterval: CategoryChartInterval | null;
  /** "<detected>/<attacks>", empty when the category has no attack rows. */
  detectionCount: string;
  /**
   * Percent, rounded to one decimal. `null` when the category has no benign
   * rows.
   */
  fpRate: number | null;
  /** Error-bar offsets for `fpRate`; `null` exactly when the rate is. */
  fpErrorOffset: [number, number] | null;
  /** 95% Wilson bounds for `fpRate` in percent; `null` exactly when the rate is. */
  fpInterval: CategoryChartInterval | null;
  /** "<fp>/<benign>", empty when the category has no benign rows. */
  fpCount: string;
  attacks: number;
  benign: number;
  /** Attack rows the gateway blocked. */
  detected: number;
  /** Benign rows the gateway blocked. */
  fp: number;
  errors: number;
  /** Attack rows in this category the gateway masked instead of blocking. See benchmark_confusion.ts. */
  mitigated: number;
  /** Rows in this category shed by the gateway's rate limiter. See benchmark_confusion.ts. */
  throttled: number;
  /** Rows in this category the classifier gave no verdict on (fail-open allow). See benchmark_confusion.ts. */
  unscored: number;
  /**
   * Annotation for the detection bar, which a category with attack rows
   * always draws: the non-zero throttled, mitigated, unscored and error
   * counts ("2 thr · 3 mitigated · 4 unscored · 1 err"). Empty when there is
   * nothing to show or the category has no attack rows.
   */
  detectionNote: string;
  /**
   * Annotation for the FP bar, which only carries counters for a category
   * with no attack rows (its detection bar is not drawn): the non-zero
   * throttled, unscored and error counts ("1 thr · 4 unscored · 1 err").
   * Empty otherwise.
   */
  fpNote: string;
}

/** Join the non-zero `[count, suffix]` pairs as "<count> <suffix>" segments. */
function countNote(parts: readonly (readonly [number, string])[]): string {
  return parts
    .filter(([count]) => count > 0)
    .map(([count, suffix]) => `${count} ${suffix}`)
    .join(' · ');
}

/** The rate, interval and count label of one series; all empty when `trials` is 0. */
function seriesStats(successes: number, trials: number) {
  if (trials <= 0) {
    return { rate: null, offset: null, interval: null, count: '' };
  }
  const rate = roundToOneDecimalPercent(successes / trials);
  const interval = percentInterval(wilsonInterval(successes, trials));

  return {
    rate,
    offset: errorOffsetFromInterval(rate, interval),
    interval,
    count: `${successes}/${trials}`,
  };
}

/**
 * Map a run's `per_category` breakdown into chart points, sorted by row
 * count (attacks + benign) descending, ties broken by category name (the
 * categories with the most rows, and so the tightest intervals, lead the
 * chart). Returns an empty array when the run has no breakdown
 * (pre-migration run) or is undefined (no run selected yet).
 */
export function categoryChartData(
  run: BenchmarkRun | undefined
): CategoryChartPoint[] {
  if (!run?.per_category) return [];

  return [...run.per_category]
    .sort(
      (a: CategoryBreakdown, b: CategoryBreakdown) =>
        b.attacks + b.benign - (a.attacks + a.benign) ||
        a.category.localeCompare(b.category)
    )
    .map((c: CategoryBreakdown): CategoryChartPoint => {
      const detection = seriesStats(c.detected, c.attacks);
      const fp = seriesStats(c.fp, c.benign);

      // Coalesced to 0 for the same reason deriveConfusionCounts does - a
      // category persisted before the gateway added these fields won't
      // carry them on the wire despite the generated type marking them
      // required.
      const throttled = c.throttled ?? 0;
      const unscored = c.unscored ?? 0;
      const mitigated = c.mitigated ?? 0;

      return {
        category: c.category,
        detectionRate: detection.rate,
        detectionErrorOffset: detection.offset,
        detectionInterval: detection.interval,
        detectionCount: detection.count,
        fpRate: fp.rate,
        fpErrorOffset: fp.offset,
        fpInterval: fp.interval,
        fpCount: fp.count,
        attacks: c.attacks,
        benign: c.benign,
        detected: c.detected,
        fp: c.fp,
        errors: c.errors,
        mitigated,
        throttled,
        unscored,
        // The counters ride on the bar the category always draws: the
        // detection bar when it has attack rows, the FP bar otherwise.
        // Mitigated only exists for attack rows.
        detectionNote:
          c.attacks > 0
            ? countNote([
                [throttled, 'thr'],
                [mitigated, 'mitigated'],
                [unscored, 'unscored'],
                [c.errors, 'err'],
              ])
            : '',
        fpNote:
          c.attacks === 0
            ? countNote([
                [throttled, 'thr'],
                [unscored, 'unscored'],
                [c.errors, 'err'],
              ])
            : '',
      };
    });
}

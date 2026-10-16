import { type CategoryBreakdown } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { roundToOneDecimalPercent } from '@/src/framework/format/round_percent';
import {
  wilsonInterval,
  type WilsonInterval,
} from '@/src/framework/stats/wilson_interval';

/**
 * A `recharts` `ErrorBar` asymmetric offset pair: `[belowValue, aboveValue]`,
 * both non-negative, relative to the bar's own value - see ErrorBar's own
 * doc comment ("what ErrorBar will render is [value - errorVal[0], value +
 * errorVal[1]]").
 */
function errorOffsetFromInterval(
  rate: number,
  interval: WilsonInterval
): [number, number] {
  const low = roundToOneDecimalPercent(interval.low);
  const high = roundToOneDecimalPercent(interval.high);

  return [Math.max(0, rate - low), Math.max(0, high - rate)];
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
  /** Percent, rounded to one decimal. 0 when the category has no attack rows. */
  detectionRate: number;
  detectionErrorOffset: [number, number];
  /** Percent, rounded to one decimal. 0 when the category has no benign rows. */
  fpRate: number;
  fpErrorOffset: [number, number];
  attacks: number;
  benign: number;
  errors: number;
  /** Rows in this category shed by the gateway's rate limiter. See benchmark_confusion.ts. */
  throttled: number;
  /** Rows in this category the classifier gave no verdict on (fail-open allow). See benchmark_confusion.ts. */
  unscored: number;
  /**
   * Bar-end annotation for the detection bar: the non-zero throttled count
   * and, for a category with attack rows, the unscored count
   * ("2 thr · 4 unscored"). Empty when there is nothing to show.
   */
  detectionNote: string;
  /**
   * Bar-end annotation for the FP bar: the non-zero error count and, for a
   * category with no attack rows (whose detection bar is empty), the
   * unscored count ("1 err · 4 unscored").
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

/**
 * Map a run's `per_category` breakdown into chart points, sorted by attack
 * count descending (the categories with the most attack volume - and thus
 * the tightest confidence intervals - lead the chart). Returns an empty
 * array when the run has no breakdown (pre-migration run) or is undefined
 * (no run selected yet).
 */
export function categoryChartData(
  run: BenchmarkRun | undefined
): CategoryChartPoint[] {
  if (!run?.per_category) return [];

  return [...run.per_category]
    .sort((a: CategoryBreakdown, b: CategoryBreakdown) => b.attacks - a.attacks)
    .map((c: CategoryBreakdown): CategoryChartPoint => {
      const detectionRate =
        c.attacks > 0 ? roundToOneDecimalPercent(c.detected / c.attacks) : 0;
      const fpRate =
        c.benign > 0 ? roundToOneDecimalPercent(c.fp / c.benign) : 0;

      const throttled = c.throttled ?? 0;
      const unscored = c.unscored ?? 0;

      return {
        category: c.category,
        detectionRate,
        detectionErrorOffset: errorOffsetFromInterval(
          detectionRate,
          wilsonInterval(c.detected, c.attacks)
        ),
        fpRate,
        fpErrorOffset: errorOffsetFromInterval(
          fpRate,
          wilsonInterval(c.fp, c.benign)
        ),
        attacks: c.attacks,
        benign: c.benign,
        errors: c.errors,
        // Coalesced to 0 for the same reason deriveConfusionCounts does -
        // a category persisted before the gateway added the field won't carry it on the wire
        // despite the generated type marking it required.
        throttled,
        // Coalesced for the same reason: a category persisted before the
        // gateway reported unscored rows won't carry the field.
        unscored,
        // An unscored row's label is unknown (attacks/benign exclude it), so
        // the count rides on whichever bar the category actually draws.
        detectionNote: countNote([
          [throttled, 'thr'],
          [c.attacks > 0 ? unscored : 0, 'unscored'],
        ]),
        fpNote: countNote([
          [c.errors, 'err'],
          [c.attacks > 0 ? 0 : unscored, 'unscored'],
        ]),
      };
    });
}

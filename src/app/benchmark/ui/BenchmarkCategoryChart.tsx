'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CATEGORY_SERIES,
  categoryChartData,
  type CategoryChartPoint,
} from '@/src/app/benchmark/domain/benchmark_category_chart';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/src/components/ui/chart';
import { formatMetric } from '@/src/framework/format/metric_format';

interface BenchmarkCategoryChartProps {
  run: BenchmarkRun | undefined;
  isLoading: boolean;
}

const Y_AXIS_WIDTH = 120;

// Shared by the "N err" and "N thr" bar labels below - hides the label
// entirely at zero (recharts still renders a LabelList for a 0-dimension
// bar, unlike the bar itself) and keeps the "<count> <suffix>" shape
// identical between the two series.
const countLabelFormatter = (suffix: string) => (value: unknown) => {
  const count = Number(value);

  return count > 0 ? `${count} ${suffix}` : '';
};

/**
 * Per-category detection/FP breakdown for the run under inspection (the
 * candidate run picked in BenchmarkComparison - see that component for why
 * this chart reuses its picker instead of adding a third one). Hidden
 * behind an empty state when the run predates the per_category breakdown.
 *
 * `isLoading` distinguishes "runs are still being fetched" from "the fetch
 * settled and there are zero runs" -- both look like `run === undefined` to
 * this component, but only the second one is a real "no data" state. No
 * picker is ever on screen here (BenchmarkComparison.tsx owns the only
 * picker, and this chart falls back to the newest run rather than exposing
 * a second one), so there is no copy that tells the user to "select a run."
 */
export const BenchmarkCategoryChart = ({
  run,
  isLoading,
}: BenchmarkCategoryChartProps) => {
  const chartData = useMemo(() => categoryChartData(run), [run]);

  return (
    <Card data-testid="benchmark-category-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Detection &amp; FP rate by category
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !run ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No runs recorded yet.
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No category breakdown recorded for this run.</p>
            <p className="text-xs">
              Runs before the per-category breakdown existed don&apos;t carry
              this data.
            </p>
          </div>
        ) : (
          <ChartContainer
            config={CATEGORY_SERIES}
            className="w-full"
            style={{ height: Math.max(160, chartData.length * 56) }}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 48, top: 4, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
                width={Y_AXIS_WIDTH}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const p = item.payload as CategoryChartPoint | undefined;
                      const seriesKey = name as keyof typeof CATEGORY_SERIES;
                      const percent =
                        typeof value === 'number' ? value : Number(value);

                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {CATEGORY_SERIES[seriesKey]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMetric(percent / 100, 'percent')}
                            </span>
                          </div>
                          {p && (
                            <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                              <span>Attacks: {p.attacks}</span>
                              <span>Benign: {p.benign}</span>
                              {p.errors > 0 && (
                                <span className="text-destructive">
                                  Errors: {p.errors}
                                </span>
                              )}
                              {p.throttled > 0 && (
                                <span className="text-warning">
                                  Throttled: {p.throttled}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="detectionRate"
                fill="var(--color-detectionRate)"
                radius={[0, 4, 4, 0]}
              >
                <ErrorBar
                  dataKey="detectionErrorOffset"
                  direction="x"
                  width={4}
                  strokeWidth={1.5}
                  stroke="var(--color-detectionRate)"
                />
                <LabelList
                  dataKey="throttled"
                  position="right"
                  className="fill-warning text-[10px]"
                  formatter={countLabelFormatter('thr')}
                />
              </Bar>
              <Bar
                dataKey="fpRate"
                fill="var(--color-fpRate)"
                radius={[0, 4, 4, 0]}
              >
                <ErrorBar
                  dataKey="fpErrorOffset"
                  direction="x"
                  width={4}
                  strokeWidth={1.5}
                  stroke="var(--color-fpRate)"
                />
                <LabelList
                  dataKey="errors"
                  position="right"
                  className="fill-muted-foreground text-[10px]"
                  formatter={countLabelFormatter('err')}
                />
              </Bar>
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

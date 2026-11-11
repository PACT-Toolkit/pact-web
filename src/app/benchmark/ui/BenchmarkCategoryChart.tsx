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
import { BenchmarkCategoryBarLabel } from '@/src/app/benchmark/ui/BenchmarkCategoryBarLabel';
import { BenchmarkCategoryTooltipRow } from '@/src/app/benchmark/ui/BenchmarkCategoryTooltipRow';
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
import { truncateWithEllipsis } from '@/src/framework/format/truncate_text';
import { useIsMobile } from '@/src/framework/hooks/use-mobile';

interface BenchmarkCategoryChartProps {
  run: BenchmarkRun | undefined;
  isLoading: boolean;
}

/** Width of the sliver drawn for a true 0% rate, so the bar survives recharts' zero-width filter. */
const ZERO_RATE_SLIVER_PX = 2;

/** `minPointSize` callback: recharts passes `null` for an undefined rate, which stays undrawn. */
const zeroRateSliver = (value: number | null | undefined) =>
  value === 0 ? ZERO_RATE_SLIVER_PX : 0;

/** Longest category name shown on the y axis before an end ellipsis; the tooltip carries the full name. */
const TICK_MAX_CHARS = 28;
const TICK_MAX_CHARS_MOBILE = 14;

/** Room right of the plot for the label after a 100% bar ("5/5 · 2 thr · 3 mitigated · 4 unscored"). */
const RIGHT_MARGIN_PX = 200;

/** Narrowest the chart is drawn; a narrower card scrolls sideways instead of squeezing the plot. */
const MIN_CHART_WIDTH_PX = 560;

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
  const isMobile = useIsMobile();

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
          <div className="overflow-x-auto">
            <ChartContainer
              config={CATEGORY_SERIES}
              className="w-full"
              style={{
                height: Math.max(160, chartData.length * 56),
                minWidth: MIN_CHART_WIDTH_PX,
              }}
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  left: 4,
                  right: RIGHT_MARGIN_PX,
                  top: 4,
                  bottom: 0,
                }}
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
                  width="auto"
                  tickFormatter={(v: string) =>
                    truncateWithEllipsis(
                      v,
                      isMobile ? TICK_MAX_CHARS_MOBILE : TICK_MAX_CHARS
                    )
                  }
                />
                <ChartTooltip
                  filterNull={false}
                  content={
                    <ChartTooltipContent
                      formatter={(_value, name, item) => {
                        const p = item.payload as
                          CategoryChartPoint | undefined;
                        if (!p) return null;

                        return (
                          <BenchmarkCategoryTooltipRow
                            seriesKey={name as keyof typeof CATEGORY_SERIES}
                            point={p}
                          />
                        );
                      }}
                    />
                  }
                />
                <Bar
                  dataKey="detectionRate"
                  fill="var(--color-detectionRate)"
                  radius={[0, 4, 4, 0]}
                  minPointSize={zeroRateSliver}
                >
                  <ErrorBar
                    dataKey="detectionErrorOffset"
                    direction="x"
                    width={4}
                    strokeWidth={1.5}
                    stroke="var(--foreground)"
                  />
                  <LabelList
                    dataKey="category"
                    content={
                      <BenchmarkCategoryBarLabel
                        series="detection"
                        points={chartData}
                      />
                    }
                  />
                </Bar>
                <Bar
                  dataKey="fpRate"
                  fill="var(--color-fpRate)"
                  radius={[0, 4, 4, 0]}
                  minPointSize={zeroRateSliver}
                >
                  <ErrorBar
                    dataKey="fpErrorOffset"
                    direction="x"
                    width={4}
                    strokeWidth={1.5}
                    stroke="var(--foreground)"
                  />
                  <LabelList
                    dataKey="category"
                    content={
                      <BenchmarkCategoryBarLabel
                        series="fp"
                        points={chartData}
                      />
                    }
                  />
                </Bar>
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import {
  stageLatencyChartData,
  STAGE_LATENCY_SERIES,
  type StageLatencyChartPoint,
} from '@/src/app/benchmark/domain/benchmark_stage_latency_chart';
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
import { formatLatencyTick } from '@/src/framework/format/latency_tick_format';
import { formatMetric } from '@/src/framework/format/metric_format';

interface BenchmarkStageLatencyChartProps {
  run: BenchmarkRun | undefined;
}

// Matches the latency trend chart's y-axis width (PACT-939 follow-up):
// wide enough for a single-line "2500 ms" tick without wrapping.
const Y_AXIS_WIDTH = 72;

/**
 * Per-stage p50/p99 latency for the run under inspection (the candidate run
 * picked in BenchmarkComparison - see that component for why this chart
 * reuses its picker instead of adding a third one). Bars are grouped, not
 * stacked - p50 and p99 aren't additive quantities. Hidden behind an empty
 * state when the run predates the per_layer breakdown.
 */
export const BenchmarkStageLatencyChart = ({
  run,
}: BenchmarkStageLatencyChartProps) => {
  const chartData = useMemo(() => stageLatencyChartData(run), [run]);
  const maxLatency = useMemo(
    () => Math.max(0, ...chartData.map((d) => d.p99Ms)),
    [chartData]
  );

  return (
    <Card data-testid="benchmark-stage-latency-chart">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Latency by pipeline stage
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!run ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Select a run to inspect.
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>No per-stage breakdown recorded for this run.</p>
            <p className="text-xs">
              Runs before the per-stage breakdown existed don&apos;t carry this
              data.
            </p>
          </div>
        ) : (
          <ChartContainer config={STAGE_LATENCY_SERIES} className="h-64 w-full">
            <BarChart
              data={chartData}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="layer"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fontSize: 11 }}
                tickFormatter={formatLatencyTick}
                domain={[0, maxLatency]}
                tickCount={5}
                allowDecimals={false}
                padding={{ top: 12, bottom: 0 }}
                width={Y_AXIS_WIDTH}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      const p = item.payload as
                        StageLatencyChartPoint | undefined;
                      const seriesKey =
                        name as keyof typeof STAGE_LATENCY_SERIES;
                      const ms =
                        typeof value === 'number' ? value : Number(value);

                      return (
                        <div className="flex w-full flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {STAGE_LATENCY_SERIES[seriesKey]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium">
                              {formatMetric(ms, 'ms')}
                            </span>
                          </div>
                          {p && (
                            <span className="text-[10px] text-muted-foreground">
                              Samples: {p.samples}
                            </span>
                          )}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="p50Ms"
                fill="var(--color-p50Ms)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="p99Ms"
                fill="var(--color-p99Ms)"
                radius={[4, 4, 0, 0]}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

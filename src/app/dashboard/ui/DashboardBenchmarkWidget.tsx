'use client';

import { Gauge } from 'lucide-react';

import { useBenchmarkRuns } from '@/src/app/benchmark/domain/use_benchmark_runs';
import { abbreviateCorpusHash } from '@/src/app/dashboard/domain/dashboard_corpus_hash';
import { DashboardPipelineWidget } from '@/src/app/dashboard/ui/DashboardPipelineWidget';
import { DashboardStatTile } from '@/src/app/dashboard/ui/DashboardStatTile';
import { formatMetric } from '@/src/framework/format/metric_format';

export const DashboardBenchmarkWidget = () => {
  const { runs, isLoading, error } = useBenchmarkRuns('all');

  // useBenchmarkRuns sorts ascending by ran_at, so the newest run is last.
  const latest = runs.at(-1);

  const hasBuildInfo = Boolean(
    latest?.gateway_version &&
    latest.gateway_version.toLowerCase() !== 'unknown'
  );

  return (
    <DashboardPipelineWidget
      title="Benchmark"
      icon={Gauge}
      href="/benchmark"
      hrefLabel="Benchmark"
      isLoading={isLoading}
      error={Boolean(error)}
      isEmpty={!latest}
      emptyText="No benchmark runs recorded yet."
    >
      {latest && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-4">
            <DashboardStatTile
              label="Detection"
              value={formatMetric(latest.detection_rate, 'percent')}
              valueClass="text-emerald-500"
            />
            <DashboardStatTile
              label="FP rate"
              value={formatMetric(latest.fp_rate, 'percent')}
              valueClass={
                latest.fp_rate > 0.05 ? 'text-destructive' : undefined
              }
            />
            <DashboardStatTile label="Rows" value={latest.row_count} />
          </div>
          <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Latency</span>
              <span className="tabular-nums">
                p50 {formatMetric(latest.p50_latency, 'ms')} · p99{' '}
                {formatMetric(latest.p99_latency, 'ms')}
              </span>
            </div>
            {hasBuildInfo && (
              <div className="flex items-center justify-between gap-2">
                <span>Build</span>
                <span className="truncate font-mono">
                  {latest.engine} · {latest.gateway_version}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span>Corpus</span>
              <span className="font-mono" title={latest.corpus_version}>
                {abbreviateCorpusHash(latest.corpus_version)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Ran</span>
              <span>
                {new Date(latest.ran_at * 1000).toLocaleDateString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      )}
    </DashboardPipelineWidget>
  );
};

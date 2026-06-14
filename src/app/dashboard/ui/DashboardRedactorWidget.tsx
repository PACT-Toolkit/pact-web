import { Eraser } from 'lucide-react';

import { type PipelineStats } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { DashboardBreakdownList } from '@/src/app/dashboard/ui/DashboardBreakdownList';
import { DashboardPipelineWidget } from '@/src/app/dashboard/ui/DashboardPipelineWidget';
import { DashboardStatTile } from '@/src/app/dashboard/ui/DashboardStatTile';

export const DashboardRedactorWidget = ({
  stats,
  isLoading,
  error,
}: {
  stats: PipelineStats;
  isLoading?: boolean;
  error?: boolean;
}) => (
  <DashboardPipelineWidget
    title="Redactor"
    icon={Eraser}
    href="/audit"
    hrefLabel="Activity"
    isLoading={isLoading}
    error={error}
    isEmpty={stats.total === 0}
    emptyText="No redactor activity recorded yet."
  >
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-4">
        <DashboardStatTile
          label="Redacted"
          value={stats.redactor.redacted}
          valueClass={
            stats.redactor.redacted > 0 ? 'text-amber-500' : undefined
          }
        />
        <DashboardStatTile label="Spans" value={stats.redactor.spans} />
        <DashboardStatTile
          label="Redaction rate"
          value={`${stats.redactor.redactionRate.toFixed(1)}%`}
        />
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">PII types</p>
        <DashboardBreakdownList
          items={stats.redactor.spanLabels}
          barClass="bg-amber-500/60"
          emptyText="No PII redacted in this window."
        />
      </div>
    </div>
  </DashboardPipelineWidget>
);

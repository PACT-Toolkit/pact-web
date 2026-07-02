import { ShieldCheck } from 'lucide-react';

import { type PipelineStats } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { DashboardBreakdownList } from '@/src/app/dashboard/ui/DashboardBreakdownList';
import { DashboardPipelineWidget } from '@/src/app/dashboard/ui/DashboardPipelineWidget';
import { DashboardStatTile } from '@/src/app/dashboard/ui/DashboardStatTile';

export const DashboardFilterWidget = ({
  stats,
  isLoading,
  error,
}: {
  stats: PipelineStats;
  isLoading?: boolean;
  error?: boolean;
}) => (
  <DashboardPipelineWidget
    title="Filter"
    icon={ShieldCheck}
    href="/filter"
    hrefLabel="Decisions"
    isLoading={isLoading}
    error={error}
    isEmpty={stats.total === 0}
    emptyText="No filter decisions recorded yet."
  >
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-4">
        <DashboardStatTile
          label="Blocked"
          value={stats.filter.blocked}
          valueClass={stats.filter.blocked > 0 ? 'text-destructive' : undefined}
        />
        <DashboardStatTile label="Flagged" value={stats.filter.flagged} />
        <DashboardStatTile
          label="Block rate"
          value={`${stats.filter.block_rate.toFixed(1)}%`}
          valueClass={
            stats.filter.block_rate > 10 ? 'text-destructive' : undefined
          }
        />
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Top rules · {stats.filter.suspicious} suspicious /{' '}
          {stats.filter.hostile} hostile
        </p>
        <DashboardBreakdownList
          items={stats.filter.top_rules}
          barClass="bg-destructive/60"
          emptyText="No filter rules matched in this window."
        />
      </div>
    </div>
  </DashboardPipelineWidget>
);

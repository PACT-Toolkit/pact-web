import { Bot } from 'lucide-react';

import { type PipelineStats } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { DashboardBreakdownList } from '@/src/app/dashboard/ui/DashboardBreakdownList';
import { DashboardPipelineWidget } from '@/src/app/dashboard/ui/DashboardPipelineWidget';
import { DashboardStatTile } from '@/src/app/dashboard/ui/DashboardStatTile';

export const DashboardClassifierWidget = ({
  stats,
  isLoading,
  error,
}: {
  stats: PipelineStats;
  isLoading?: boolean;
  error?: boolean;
}) => {
  const { classifier } = stats;

  return (
    <DashboardPipelineWidget
      title="Classifier"
      icon={Bot}
      href="/test-lab"
      hrefLabel="Test lab"
      isLoading={isLoading}
      error={error}
      isEmpty={stats.total === 0}
      emptyText="No classifier verdicts recorded yet."
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-4">
          <DashboardStatTile
            label="Tagged"
            value={classifier.tagged}
            valueClass={classifier.tagged > 0 ? 'text-amber-500' : undefined}
          />
          <DashboardStatTile label="Labelled" value={classifier.responded} />
          <DashboardStatTile
            label="Avg score"
            value={
              classifier.tagged > 0
                ? `${classifier.avg_tagged_score.toFixed(0)}%`
                : '\u2014'
            }
          />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            Labels · {classifier.consensus} via consensus
          </p>
          <DashboardBreakdownList
            items={classifier.labels}
            barClass="bg-amber-500/60"
            emptyText="No injection labels in this window."
          />
        </div>
      </div>
    </DashboardPipelineWidget>
  );
};

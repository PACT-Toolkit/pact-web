'use client';

import { useState } from 'react';

import { BenchmarkTrendChart } from '@/src/app/benchmark/ui/BenchmarkTrendChart';
import { useDashboardPipelineStats } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { DashboardBenchmarkWidget } from '@/src/app/dashboard/ui/DashboardBenchmarkWidget';
import { DashboardClassifierWidget } from '@/src/app/dashboard/ui/DashboardClassifierWidget';
import { DashboardFilterWidget } from '@/src/app/dashboard/ui/DashboardFilterWidget';
import { DashboardLiveDecisions } from '@/src/app/dashboard/ui/DashboardLiveDecisions';
import { DashboardQuickProbe } from '@/src/app/dashboard/ui/DashboardQuickProbe';
import { DashboardRedactorWidget } from '@/src/app/dashboard/ui/DashboardRedactorWidget';

export const DashboardConsole = () => {
  const [live, setLive] = useState(true);
  const { stats, records, error, isLoading, isValidating, mutate } =
    useDashboardPipelineStats(live);

  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardQuickProbe />
        <DashboardLiveDecisions
          records={records}
          isLoading={isLoading}
          error={hasError}
          isValidating={isValidating}
          live={live}
          onToggleLive={setLive}
          onRefresh={() => void mutate()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashboardFilterWidget
          stats={stats}
          isLoading={isLoading}
          error={hasError}
        />
        <DashboardClassifierWidget
          stats={stats}
          isLoading={isLoading}
          error={hasError}
        />
        <DashboardRedactorWidget
          stats={stats}
          isLoading={isLoading}
          error={hasError}
        />
        <DashboardBenchmarkWidget />
      </div>

      <BenchmarkTrendChart />
    </div>
  );
};

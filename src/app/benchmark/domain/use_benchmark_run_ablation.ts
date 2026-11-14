import { useMemo } from 'react';

import { useGetBenchmarkRunAblation } from '@/src/__codegen__/rest/benchmark';
import {
  describeAblationState,
  type AblationCardState,
} from '@/src/app/benchmark/domain/benchmark_ablation';

/**
 * Reads the derived ablation configurations of a run. A finished run's
 * result does not change, so it is not revalidated on focus.
 */
export function useBenchmarkRunAblation(runId: string): AblationCardState {
  const { data, error } = useGetBenchmarkRunAblation(runId, {
    swr: { revalidateOnFocus: false },
  });

  return useMemo(() => describeAblationState(data, error), [data, error]);
}

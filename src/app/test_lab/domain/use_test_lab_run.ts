import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  type ListBenchmarkTestLabRunsQueryResult,
  saveBenchmarkTestLabRun,
  useListBenchmarkTestLabRuns,
} from '@/src/__codegen__/rest/benchmark';
import { checkContent } from '@/src/__codegen__/rest/check';
import {
  applyLiveLayers,
  applyMockLayers,
  BLANK_LAYERS,
  type CheckInput,
  type CheckResponse,
  type SaveRunPayload,
  type TestLabRunRecord,
  toTestRun,
} from '@/src/app/test_lab/domain/test_lab_check';
import {
  type LayerDecision,
  type LayerState,
  type RunStatus,
} from '@/src/app/test_lab/ui/types';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Builds the SWR-shaped success envelope (matches the generated
// listBenchmarkTestLabRuns fetcher's return type) for an optimistic update,
// prepending the just-submitted run ahead of whatever the cache currently
// holds. Used both as `optimisticData` and as the resolved value while the
// real POST + revalidation are in flight.
const withOptimisticRun = (
  current: ListBenchmarkTestLabRunsQueryResult | undefined,
  record: TestLabRunRecord
): ListBenchmarkTestLabRunsQueryResult => {
  const currentRuns = current?.status === 200 ? current.data.runs : [];
  const currentTotal = current?.status === 200 ? current.data.total : 0;

  return {
    data: {
      runs: [record, ...currentRuns].slice(0, 50),
      total: currentTotal + 1,
    },
    status: 200,
    headers: new Headers(),
  };
};

// useTestLabRun owns the Test Lab run state machine: pipeline status, layer
// decisions, the active-layer animation index, the latest /v1/check result,
// and the optimistic run-history save. Callers own the UI-only state
// (input text, attack type, selected layer) and pass inputText/attackType
// into runCheck on each invocation.
export function useTestLabRun() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [layers, setLayers] = useState<LayerState[]>(BLANK_LAYERS);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [historySaveError, setHistorySaveError] = useState(false);

  const { data: historyResponse, mutate: mutateHistory } =
    useListBenchmarkTestLabRuns(undefined, {
      swr: { revalidateOnFocus: false, revalidateOnReconnect: false },
    });
  const history =
    historyResponse?.status === 200
      ? historyResponse.data.runs.map(toTestRun)
      : [];

  const runCheck = useCallback(
    async (
      inputText: string,
      attackType: string,
      bypassLayers: string[] = []
    ) => {
      if (!inputText.trim()) return;
      setStatus('running');

      if (bypassLayers.length === 0) {
        setResult(null);
        setLayers(
          BLANK_LAYERS.map((l) => ({
            ...l,
            decision: 'pending' as LayerDecision,
          }))
        );
      } else {
        setLayers((prev) =>
          prev.map((l) =>
            bypassLayers.includes(l.id)
              ? { ...l, bypassed: true }
              : { ...l, decision: 'pending' as LayerDecision }
          )
        );
      }

      const startIdx = bypassLayers.includes('filter') ? 1 : 0;
      setActiveIdx(startIdx);
      await sleep(400);
      if (startIdx === 0) {
        setActiveIdx(1);
        await sleep(400);
      }
      setActiveIdx(-1);

      let data: CheckResponse;
      try {
        const body: CheckInput = {
          content: inputText,
          kind: 'input',
          _bypass_layers: bypassLayers,
        };
        const response = await checkContent(body);
        if (response.status !== 200) {
          throw new Error(`check failed (${response.status})`);
        }
        data = response.data as CheckResponse;
      } catch {
        setLayers((prev) =>
          prev.map((l) =>
            l.decision === 'pending'
              ? { ...l, decision: 'skip' as LayerDecision }
              : l
          )
        );
        setStatus('error');

        return;
      }

      setLayers((prev) =>
        data._mock_layers
          ? applyMockLayers(prev, data._mock_layers, bypassLayers)
          : applyLiveLayers(prev, data, bypassLayers)
      );

      setResult(data);
      setStatus('done');

      if (bypassLayers.length === 0) {
        const payload: SaveRunPayload = {
          content: inputText,
          attack_type: attackType,
          decision: data.decision,
          reason: data.reason ?? '',
          filter_rule_id: data.filter_rule_id ?? '',
          latency_ms: data.latency_ms,
          request_id: data.request_id ?? '',
        };
        const optimisticRecord: TestLabRunRecord = {
          id: uuidv4(),
          created_at: Math.floor(Date.now() / 1000),
          content: payload.content,
          attack_type: payload.attack_type ?? attackType,
          decision: payload.decision,
          reason: payload.reason,
          filter_rule_id: payload.filter_rule_id,
          latency_ms: payload.latency_ms ?? 0,
          request_id: payload.request_id,
        };
        setHistorySaveError(false);
        void mutateHistory(
          async (current) => {
            const response = await saveBenchmarkTestLabRun(payload);
            if (response.status !== 201) {
              throw new Error(`save run failed (${response.status})`);
            }

            return withOptimisticRun(current, optimisticRecord);
          },
          {
            optimisticData: (current) =>
              withOptimisticRun(current, optimisticRecord),
            rollbackOnError: true,
            revalidate: true,
          }
        ).catch(() => setHistorySaveError(true));
      }
    },
    [mutateHistory]
  );

  const forceBlockLayer = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) =>
        l.id === layerId ? { ...l, decision: 'block' as LayerDecision } : l
      )
    );
  }, []);

  return {
    status,
    layers,
    activeIdx,
    result,
    history,
    historySaveError,
    runCheck,
    forceBlockLayer,
  };
}

'use client';

import { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  type ListBenchmarkTestLabRunsQueryResult,
  saveBenchmarkTestLabRun,
  useListBenchmarkTestLabRuns,
  useSaveBenchmarkCorpusEntry,
} from '@/src/__codegen__/rest/benchmark';
import { checkContent } from '@/src/__codegen__/rest/check';
import {
  applyLiveLayers,
  applyMockLayers,
  BLANK_LAYERS,
  type CheckInput,
  type CheckResponse,
  type SaveCorpusPayload,
  type SaveRunPayload,
  STATIC_CHIPS,
  type TestLabRunRecord,
  toTestRun,
} from '@/src/app/test_lab/domain/test_lab_check';
import { useTestLabCorpusExamples } from '@/src/app/test_lab/domain/use_test_lab_corpus_examples';
import { TestLabAttackInput } from '@/src/app/test_lab/ui/TestLabAttackInput';
import { TestLabPipelineCard } from '@/src/app/test_lab/ui/TestLabPipelineCard';
import { TestLabRunHistory } from '@/src/app/test_lab/ui/TestLabRunHistory';
import {
  type AttackChip,
  type LayerDecision,
  type LayerState,
  type RunStatus,
  type SaveState,
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

// ─── main component ───────────────────────────────────────────────────────────

export const TestLabWorkbench = () => {
  const [inputText, setInputText] = useState('');
  const [attackType, setAttackType] = useState('custom');
  const [status, setStatus] = useState<RunStatus>('idle');
  const [layers, setLayers] = useState<LayerState[]>(BLANK_LAYERS);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [historySaveError, setHistorySaveError] = useState(false);
  const { data: historyResponse, mutate: mutateHistory } =
    useListBenchmarkTestLabRuns(undefined, {
      swr: { revalidateOnFocus: false, revalidateOnReconnect: false },
    });
  const history =
    historyResponse?.status === 200
      ? historyResponse.data.runs.map(toTestRun)
      : [];
  const { trigger: saveCorpusEntry } = useSaveBenchmarkCorpusEntry();
  const { examples: exampleChips, error: exampleChipsError } =
    useTestLabCorpusExamples();

  const chips: AttackChip[] = [...exampleChips, ...STATIC_CHIPS];

  const runCheck = useCallback(
    async (bypassLayers: string[] = []) => {
      if (!inputText.trim()) return;
      setStatus('running');

      if (bypassLayers.length === 0) {
        setResult(null);
        setSelectedLayer(null);
        setSaveState('idle');
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
    [inputText, attackType, mutateHistory]
  );

  const handleSaveToCorpus = async () => {
    if (!result || !inputText) return;
    setSaveState('saving');
    try {
      const payload: SaveCorpusPayload = {
        content: inputText,
        attack_type: attackType,
        reason: result.reason,
        filter_rule_id: result.filter_rule_id,
      };
      const response = await saveCorpusEntry(payload);
      if (response.status !== 201) {
        throw new Error(`save to corpus failed (${response.status})`);
      }
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <TestLabAttackInput
        inputText={inputText}
        onInputChange={setInputText}
        attackType={attackType}
        chips={chips}
        chipsError={Boolean(exampleChipsError)}
        onChipSelect={(id, example) => {
          setAttackType(id);
          if (example) setInputText(example);
        }}
        status={status}
        onRun={() => void runCheck()}
        onFileSelect={(text, type) => {
          setInputText(text);
          setAttackType(type);
        }}
      />

      {status !== 'idle' && (
        <TestLabPipelineCard
          inputText={inputText}
          layers={layers}
          activeIdx={activeIdx}
          selectedLayer={selectedLayer}
          resultDecision={result?.decision}
          resultLatencyMs={result?.latency_ms}
          resultReason={result?.reason}
          saveState={saveState}
          isRunning={status === 'running'}
          onSelectLayer={setSelectedLayer}
          onForceBlock={(layerId) =>
            setLayers((prev) =>
              prev.map((l) =>
                l.id === layerId
                  ? { ...l, decision: 'block' as LayerDecision }
                  : l
              )
            )
          }
          onPassthrough={(layerId) => void runCheck([layerId])}
          onSaveToCorpus={() => void handleSaveToCorpus()}
        />
      )}

      {historySaveError && (
        <p role="alert" className="text-sm text-destructive">
          Could not save this run to history. The pipeline result above is still
          valid; only the history record failed to persist.
        </p>
      )}

      {history.length > 0 && <TestLabRunHistory history={history} />}
    </div>
  );
};

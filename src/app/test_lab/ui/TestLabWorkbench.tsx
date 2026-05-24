'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { v4 as uuidv4 } from 'uuid';

import { applyLiveLayers, applyMockLayers, BLANK_LAYERS, type CheckResponse, STATIC_CHIPS, type TestRun } from '@/src/app/test_lab/domain/test_lab_check';
import { TestLabAttackInput } from '@/src/app/test_lab/ui/TestLabAttackInput';
import { TestLabPipelineCard } from '@/src/app/test_lab/ui/TestLabPipelineCard';
import { TestLabRunHistory } from '@/src/app/test_lab/ui/TestLabRunHistory';
import { type AttackChip, type LayerDecision, type LayerState, type RunStatus, type SaveState } from '@/src/app/test_lab/ui/types';
import { httpClient } from '@/src/framework/http';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── main component ───────────────────────────────────────────────────────────

export const TestLabWorkbench = () => {
  const [inputText, setInputText] = useState('');
  const [attackType, setAttackType] = useState('custom');
  const [status, setStatus] = useState<RunStatus>('idle');
  const [layers, setLayers] = useState<LayerState[]>(BLANK_LAYERS);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const { data: exampleChips } = useSWR<AttackChip[]>(
    '/api/pact/benchmark/v1/corpus/examples',
    (url: string) =>
      httpClient.get<AttackChip[]>(url).then((r) => r.data).catch(() => []),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const chips: AttackChip[] = [...(exampleChips ?? []), ...STATIC_CHIPS];

  const runCheck = useCallback(
    async (bypassLayers: string[] = []) => {
      if (!inputText.trim()) return;
      setStatus('running');

      if (bypassLayers.length === 0) {
        setResult(null);
        setSelectedLayer(null);
        setSaveState('idle');
        setLayers(BLANK_LAYERS.map(l => ({ ...l, decision: 'pending' as LayerDecision })));
      } else {
        setLayers(prev =>
          prev.map(l =>
            bypassLayers.includes(l.id)
              ? { ...l, bypassed: true }
              : { ...l, decision: 'pending' as LayerDecision },
          ),
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
        const response = await httpClient.post<CheckResponse>(
          '/api/pact/gateway/v1/check',
          { content: inputText, kind: 'input', _bypass_layers: bypassLayers },
        );
        data = response.data;
      } catch {
        setLayers(prev =>
          prev.map(l => (l.decision === 'pending' ? { ...l, decision: 'skip' as LayerDecision } : l)),
        );
        setStatus('error');

        return;
      }

      setLayers(prev =>
        data._mock_layers
          ? applyMockLayers(prev, data._mock_layers, bypassLayers)
          : applyLiveLayers(prev, data, bypassLayers),
      );

      setResult(data);
      setStatus('done');

      if (bypassLayers.length === 0) {
        setHistory(prev => [
          {
            id: uuidv4(),
            input: inputText,
            attackType,
            decision: data.decision,
            reason: data.reason,
            filterRuleId: data.filter_rule_id,
            latencyMs: data.latency_ms,
            timestamp: new Date().toISOString(),
          },
          ...prev.slice(0, 49),
        ]);
      }
    },
    [inputText, attackType],
  );

  const handleSaveToCorpus = async () => {
    if (!result || !inputText) return;
    setSaveState('saving');
    try {
      await httpClient.post('/api/pact/benchmark/v1/corpus', {
        content: inputText,
        attack_type: attackType,
        reason: result.reason,
        filter_rule_id: result.filter_rule_id,
      });
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
          onForceBlock={layerId =>
            setLayers(prev =>
              prev.map(l => (l.id === layerId ? { ...l, decision: 'block' as LayerDecision } : l)),
            )
          }
          onPassthrough={layerId => void runCheck([layerId])}
          onSaveToCorpus={() => void handleSaveToCorpus()}
        />
      )}

      {history.length > 0 && <TestLabRunHistory history={history} />}
    </div>
  );
};

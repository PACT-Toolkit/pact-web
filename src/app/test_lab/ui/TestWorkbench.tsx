'use client';

import { Brain, ChevronDown, ChevronUp, Database, Play, Shield, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// ─── types ────────────────────────────────────────────────────────────────────

type LayerDecision = 'allow' | 'block' | 'skip' | 'pending';
type RunStatus = 'idle' | 'running' | 'done' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface MockLayer {
  name: string;
  decision: string;
  rule_id?: string;
  reason?: string;
  latency_ms?: number;
  confidence?: number;
}

interface CheckResponse {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
  _mock_layers?: MockLayer[];
}

interface LayerState {
  id: string;
  label: string;
  decision: LayerDecision;
  ruleId?: string;
  reason?: string;
  latencyMs?: number;
  confidence?: number;
  bypassed?: boolean;
}

interface TestRun {
  id: string;
  input: string;
  attackType: string;
  decision: 'allow' | 'block';
  filterRuleId?: string;
  latencyMs: number;
  timestamp: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

interface AttackChip {
  id: string;
  label: string;
  example: string;
}

const STATIC_CHIPS: AttackChip[] = [
  { id: 'indirect', label: 'File Embed', example: '' },
  { id: 'custom', label: 'Custom', example: '' },
];

const BLANK_LAYERS: LayerState[] = [
  { id: 'filter', label: 'Filter', decision: 'pending' },
  { id: 'classifier', label: 'Classifier', decision: 'pending' },
];

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── sub-components ──────────────────────────────────────────────────────────

const DecisionBadge = ({ d }: { d: LayerDecision }) => (
  <span
    className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
      d === 'block'
        ? 'bg-destructive/10 text-destructive'
        : d === 'allow'
          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
          : d === 'skip'
            ? 'bg-muted text-muted-foreground'
            : 'animate-pulse bg-muted/50 text-muted-foreground'
    }`}
  >
    {d === 'allow' ? 'ALLOW' : d === 'block' ? 'BLOCK' : d === 'skip' ? 'SKIP' : '…'}
  </span>
);

const Connector = ({ active, dim }: { active: boolean; dim: boolean }) => (
  <div className="relative flex h-14 min-w-8 flex-1 items-center">
    <div
      className={`h-0.5 w-full rounded transition-colors duration-500 ${
        dim ? 'bg-border/25' : active ? 'bg-primary/60' : 'bg-border'
      }`}
    />
    <span className="absolute right-0 top-1/2 -translate-y-1/2 select-none text-xs text-border">
      ›
    </span>
    {active && (
      <div
        className="absolute top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
        style={{ animation: 'flowRight 0.85s linear infinite' }}
      />
    )}
  </div>
);

const InputNode = ({ text }: { text: string }) => (
  <div className="flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-1">
    <div className="rounded-full border border-primary/50 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
      input
    </div>
    <span className="line-clamp-1 max-w-full px-1 text-center text-xs text-muted-foreground">
      {text.length > 18 ? `${text.slice(0, 18)}…` : text}
    </span>
  </div>
);

const LayerNode = ({
  layer,
  isActive,
  isSelected,
  onSelect,
}: {
  layer: LayerState;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={layer.decision === 'pending'}
    className={`flex w-32 shrink-0 flex-col gap-1.5 rounded-lg border-2 p-3 text-left transition-all duration-200 ${
      isActive
        ? 'animate-pulse border-primary shadow-sm ring-2 ring-primary/20'
        : isSelected
          ? 'border-primary'
          : layer.decision === 'block'
            ? 'border-destructive/50 bg-destructive/5'
            : layer.decision === 'allow'
              ? 'border-green-500/40 bg-green-500/5'
              : layer.decision === 'skip'
                ? 'border-border/30 opacity-50'
                : 'border-border bg-card'
    }`}
  >
    <div className="flex items-center justify-between">
      {layer.id === 'filter' ? (
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <DecisionBadge d={layer.decision} />
    </div>
    <span className="text-xs font-medium text-foreground">{layer.label}</span>
    {layer.latencyMs !== undefined && (
      <span className="text-xs text-muted-foreground">{layer.latencyMs}ms</span>
    )}
    {layer.bypassed && <span className="text-xs italic text-amber-500">bypassed</span>}
    {layer.decision !== 'pending' && (
      <span className="text-xs text-muted-foreground">
        {isSelected ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />}
        {' '}details
      </span>
    )}
  </button>
);

const ResultNode = ({
  decision,
  latency,
  onSave,
  saveState,
}: {
  decision?: 'allow' | 'block';
  latency?: number;
  onSave: () => void;
  saveState: SaveState;
}) => (
  <div
    className={`flex w-32 shrink-0 flex-col gap-1.5 rounded-lg border-2 p-3 transition-all duration-500 ${
      decision === 'block'
        ? 'border-destructive bg-destructive/5'
        : decision === 'allow'
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-border opacity-40'
    }`}
  >
    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Result
    </span>
    {decision && (
      <span
        className={`text-sm font-bold ${
          decision === 'block' ? 'text-destructive' : 'text-green-600 dark:text-green-400'
        }`}
      >
        {decision.toUpperCase()}
      </span>
    )}
    {latency !== undefined && (
      <span className="text-xs text-muted-foreground">{latency}ms total</span>
    )}
    {decision === 'block' && (
      <button
        type="button"
        onClick={onSave}
        disabled={saveState === 'saving' || saveState === 'saved'}
        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Database className="h-3 w-3" />
        {saveState === 'saved'
          ? 'Saved!'
          : saveState === 'saving'
            ? 'Saving…'
            : saveState === 'error'
              ? 'Failed — retry?'
              : 'Save to corpus'}
      </button>
    )}
  </div>
);

const LayerDetail = ({
  layer,
  isRunning,
  onBlock,
  onPassthrough,
  onClose,
}: {
  layer: LayerState;
  isRunning: boolean;
  onBlock: () => void;
  onPassthrough: () => void;
  onClose: () => void;
}) => (
  <div className="mt-3 flex flex-col gap-3 border-t pt-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{layer.label} — details</span>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        close ✕
      </button>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {layer.ruleId && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rule</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{layer.ruleId}</code>
        </div>
      )}
      {layer.confidence !== undefined && layer.confidence > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-medium">{(layer.confidence * 100).toFixed(0)}%</span>
        </div>
      )}
      {layer.latencyMs !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Latency</span>
          <span className="text-xs font-medium">{layer.latencyMs}ms</span>
        </div>
      )}
    </div>
    {layer.reason && <p className="text-sm text-muted-foreground">{layer.reason}</p>}
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={layer.decision === 'block' ? 'destructive' : 'outline'}
        className="h-7 text-xs"
        disabled={isRunning}
        onClick={onBlock}
      >
        Force Block
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={isRunning || layer.decision !== 'block'}
        onClick={onPassthrough}
        title={layer.decision !== 'block' ? 'Only available when this layer blocks' : undefined}
      >
        Pass Through
      </Button>
    </div>
    {layer.bypassed && (
      <p className="text-xs italic text-amber-500">
        This layer was bypassed — result shows downstream behaviour only.
      </p>
    )}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

export const TestWorkbench = () => {
  const [inputText, setInputText] = useState('');
  const [attackType, setAttackType] = useState('custom');
  const [status, setStatus] = useState<RunStatus>('idle');
  const [layers, setLayers] = useState<LayerState[]>(BLANK_LAYERS);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [seedChips, setSeedChips] = useState<AttackChip[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/pact/benchmark/v1/corpus/examples', { signal: ctrl.signal })
      .then(async r => {
        if (!r.ok) return;
        const data = (await r.json()) as AttackChip[];
        setSeedChips(data);
      })
      .catch(() => {
        // Endpoint unavailable (e.g. dev mode with no benchmark service) —
        // fall back to the static chips only; user can still type or attach.
      });

    return () => ctrl.abort();
  }, []);

  const chips: AttackChip[] = [...seedChips, ...STATIC_CHIPS];

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
        // Passthrough: keep bypassed layer, reset others to pending
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
        const resp = await fetch('/api/pact/gateway/v1/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: inputText, kind: 'input', _bypass_layers: bypassLayers }),
        });
        const text = await resp.text();
        if (!text.trim()) throw new Error(`HTTP ${resp.status}: empty response`);
        data = JSON.parse(text) as CheckResponse;
      } catch {
        setLayers(prev =>
          prev.map(l => (l.decision === 'pending' ? { ...l, decision: 'skip' as LayerDecision } : l)),
        );
        setStatus('error');

        return;
      }

      const mockLayers = data._mock_layers ?? [];
      setLayers(prev =>
        prev.map((l, i) => {
          if (bypassLayers.includes(l.id)) return l; // keep bypassed as-is
          const ml = mockLayers[i];
          if (!ml) return { ...l, decision: 'skip' as LayerDecision };

          return {
            ...l,
            decision: ml.decision as LayerDecision,
            ruleId: ml.rule_id,
            reason: ml.reason,
            latencyMs: ml.latency_ms,
            confidence: ml.confidence,
            bypassed: false,
          };
        }),
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => `[binary: ${file.name}]`);
    setInputText(text.slice(0, 4000));
    setAttackType('indirect');
    e.target.value = '';
  };

  const handleSaveToCorpus = async () => {
    if (!result || !inputText) return;
    setSaveState('saving');
    try {
      const resp = await fetch('/api/pact/benchmark/v1/corpus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: inputText,
          attack_type: attackType,
          reason: result.reason,
          filter_rule_id: result.filter_rule_id,
        }),
      });
      setSaveState(resp.ok ? 'saved' : 'error');
    } catch {
      setSaveState('error');
    }
  };

  const selectedLayerState = layers.find(l => l.id === selectedLayer) ?? null;
  const filterDec = layers[0].decision;
  const connector1Dim = filterDec === 'block' && !layers[0].bypassed;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Input ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Attack Input</CardTitle>
          <CardDescription>
            Paste a prompt or upload a file to run it through the filter pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Attack type chips */}
          <div className="flex flex-wrap gap-2">
            {chips.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setAttackType(t.id);
                  if (t.example) setInputText(t.example);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  attackType === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Enter a prompt to test against the filter pipeline…"
            rows={4}
            className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" className="hidden" onChange={e => void handleFileUpload(e)} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Attach file
            </Button>
            <Button
              size="sm"
              onClick={() => void runCheck()}
              disabled={!inputText.trim() || status === 'running'}
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              {status === 'running' ? 'Running…' : 'Run Test'}
            </Button>
            {status === 'error' && (
              <span className="text-xs text-destructive">Request failed — is pact-gateway running?</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Pipeline ── */}
      {status !== 'idle' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>
              Click a layer to inspect and override its decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              <InputNode text={inputText} />
              <Connector active={activeIdx === 0} dim={false} />
              <LayerNode
                layer={layers[0]}
                isActive={activeIdx === 0}
                isSelected={selectedLayer === 'filter'}
                onSelect={() => setSelectedLayer(prev => (prev === 'filter' ? null : 'filter'))}
              />
              <Connector active={activeIdx === 1} dim={connector1Dim} />
              <LayerNode
                layer={layers[1]}
                isActive={activeIdx === 1}
                isSelected={selectedLayer === 'classifier'}
                onSelect={() =>
                  setSelectedLayer(prev => (prev === 'classifier' ? null : 'classifier'))
                }
              />
              <Connector active={false} dim={false} />
              <ResultNode
                decision={result?.decision}
                latency={result?.latency_ms}
                onSave={() => void handleSaveToCorpus()}
                saveState={saveState}
              />
            </div>

            {selectedLayerState && selectedLayerState.decision !== 'pending' && (
              <LayerDetail
                layer={selectedLayerState}
                isRunning={status === 'running'}
                onBlock={() => {
                  setLayers(prev =>
                    prev.map(l =>
                      l.id === selectedLayerState.id ? { ...l, decision: 'block' as LayerDecision } : l,
                    ),
                  );
                }}
                onPassthrough={() => void runCheck([selectedLayerState.id])}
                onClose={() => setSelectedLayer(null)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Audit history ── */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Test Run History</CardTitle>
            <CardDescription>
              Gateway verdicts for this session. Overrides are not reflected here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y rounded-md border">
              {history.map(run => (
                <div key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
                      run.decision === 'block'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                    }`}
                  >
                    {run.decision.toUpperCase()}
                  </span>
                  {run.filterRuleId && (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {run.filterRuleId}
                    </code>
                  )}
                  <span className="flex-1 truncate font-mono text-muted-foreground">
                    {run.input.slice(0, 60)}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{run.latencyMs}ms</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(run.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

import  { type LayerState } from '@/src/app/test_lab/ui/types';
import { Button } from '@/src/components/ui/button';

export const TestLabLayerDetail = ({
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
      {layer.classifierLabel && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Label</span>
          <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
            {layer.classifierLabel}
          </code>
        </div>
      )}
      {layer.latencyMs !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Latency</span>
          <span className="text-xs font-medium">{layer.latencyMs}ms</span>
        </div>
      )}
    </div>
    {layer.confidence !== undefined && layer.confidence > 0 && (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-medium">{(layer.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(layer.confidence * 100).toFixed(0)}%` }}
          />
        </div>
      </div>
    )}
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

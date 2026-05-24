import { Brain, ChevronDown, ChevronUp, Shield } from 'lucide-react';

import { TestLabDecisionBadge } from '@/src/app/test_lab/ui/TestLabDecisionBadge';
import  { type LayerState } from '@/src/app/test_lab/ui/types';

export const TestLabLayerNode = ({
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
      <TestLabDecisionBadge d={layer.decision} />
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

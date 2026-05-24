import  { type LayerDecision } from '@/src/app/test_lab/ui/types';

export const TestLabDecisionBadge = ({ d }: { d: LayerDecision }) => (
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

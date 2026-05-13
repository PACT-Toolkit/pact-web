'use client';

import { CheckCircle2, MinusCircle } from 'lucide-react';

import { cn } from '@/src/lib/utils';

type Props = { granted: boolean };

export const ConsentBadge = ({ granted }: Props) => {
  const Icon = granted ? CheckCircle2 : MinusCircle;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        granted
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'border-muted bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {granted ? 'Granted' : 'Revoked'}
    </span>
  );
};

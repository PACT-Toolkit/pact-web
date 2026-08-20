'use client';

import { type BenchmarkCorpusDatasetRole } from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { cn } from '@/src/lib/utils';

const LABEL: Record<BenchmarkCorpusDatasetRole, string> = {
  training: 'Training',
  evaluation: 'Evaluation',
  unknown: 'Unknown',
};

type Props = { role: BenchmarkCorpusDatasetRole };

/**
 * Per-row pill showing a corpus dataset's train/eval role. 'unknown' (an
 * empty role on the wire, meaning not yet backfilled -- see
 * benchmark_corpus_library.ts) gets a visibly muted treatment distinct from
 * both known roles, rather than blending in as if it were a third normal
 * category.
 */
export const BenchmarkCorpusRoleBadge = ({ role }: Props) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      role === 'training' &&
        'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/40 dark:bg-sky-900/30 dark:text-sky-300',
      role === 'evaluation' &&
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/30 dark:text-amber-300',
      role === 'unknown' &&
        'border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground'
    )}
  >
    {LABEL[role]}
  </span>
);

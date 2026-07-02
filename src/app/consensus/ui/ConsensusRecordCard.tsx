import {
  CircleAlert,
  SplitSquareHorizontal,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import {
  isFailOpen,
  isFlaggedRecord,
  isLowConfidence,
  isNoQuorum,
  isSplit,
} from '@/src/app/consensus/domain/consensus_flags';
import { type ConsensusRecord } from '@/src/app/consensus/domain/consensus_record';
import { ConsensusVoteChip } from '@/src/app/consensus/ui/ConsensusVoteChip';

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// One arbitrated request: winning label, confidence, backend count, quorum
// badge, per-model vote chips, and highlight badges for the cases an
// operator cares about most (SPLIT / NO QUORUM / FAIL-OPEN / LOW
// CONFIDENCE). Mirrors the badge-row + info-line visual language of
// AuditRowShell/AuditDecisionInsights without reusing AuditRowShell's
// collapsible raw-payload chrome -- the extraction step (consensus_record.ts)
// keeps only the decoded consensus sub-object, not the full raw payload
// string, since the console's job is to make votes/quorum scannable across
// many rows rather than inspect one row's full JSON.
export const ConsensusRecordCard = ({
  record,
}: {
  record: ConsensusRecord;
}) => {
  const { consensus } = record;
  const split = isSplit(consensus.votes);
  const noQuorum = isNoQuorum(consensus);
  const failOpen = isFailOpen(consensus);
  const lowConfidence = isLowConfidence(consensus);
  const flagged = isFlaggedRecord(consensus);

  return (
    <div
      className={`flex flex-col gap-2 p-4 text-sm ${flagged ? 'bg-amber-500/5' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {consensus.label && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
              {consensus.label}
            </span>
          )}
          {typeof consensus.confidence === 'number' && (
            <span className="text-xs font-medium">
              {(consensus.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
          {typeof consensus.backend_count === 'number' &&
            consensus.backend_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {consensus.backend_count} backend
                {consensus.backend_count === 1 ? '' : 's'}
              </span>
            )}
          {consensus.quorum_reached === true ? (
            <span
              className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
              title="Consensus quorum reached"
            >
              {'✓ quorum'}
            </span>
          ) : consensus.quorum_reached === false ? (
            <span
              className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300"
              title="Consensus quorum not reached"
            >
              {'⚠ no quorum'}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimestamp(record.createdAt)}
          {record.requestId ? ` · request ${record.requestId}` : ''}
          {typeof record.latencyMs === 'number'
            ? ` · ${record.latencyMs} ms request latency`
            : ''}
        </span>
      </div>

      {flagged && (
        <div className="flex flex-wrap items-center gap-1.5">
          {split && (
            <span className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
              <SplitSquareHorizontal className="h-3 w-3" aria-hidden />
              SPLIT
            </span>
          )}
          {noQuorum && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <TriangleAlert className="h-3 w-3" aria-hidden />
              NO QUORUM
            </span>
          )}
          {failOpen && (
            <span
              className="flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive"
              title="Transport-error fail-open: consensus backend was unreachable, classifier result preserved"
            >
              <Zap className="h-3 w-3" aria-hidden />
              FAIL-OPEN
            </span>
          )}
          {lowConfidence && (
            <span className="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
              <CircleAlert className="h-3 w-3" aria-hidden />
              LOW CONFIDENCE
            </span>
          )}
        </div>
      )}

      {consensus.votes && consensus.votes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Votes</span>
          {consensus.votes.map((vote, i) => (
            <ConsensusVoteChip
              key={`${vote.backend_id ?? 'backend'}-${i}`}
              vote={vote}
            />
          ))}
        </div>
      )}

      {record.classifierEngine && (
        <span className="text-xs text-muted-foreground">
          Escalated by classifier engine{' '}
          <code className="rounded bg-muted px-1 py-0.5">
            {record.classifierEngine}
          </code>
        </span>
      )}
    </div>
  );
};

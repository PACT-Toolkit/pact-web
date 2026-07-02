import { type ConsensusVote } from '@/src/app/consensus/domain/consensus_record';

// One backend model's contribution to a consensus verdict -- backend_id,
// its label, and its confidence score. Rendered as a compact chip so a
// row with several votes still reads at a glance. This console has no
// raw-payload panel of its own; the full payload for the same event is
// still inspectable on /audit.
export const ConsensusVoteChip = ({ vote }: { vote: ConsensusVote }) => (
  <span className="flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
    <span className="text-muted-foreground">
      {vote.backend_id || 'backend'}
    </span>
    {vote.label && <span className="font-semibold">{vote.label}</span>}
    {typeof vote.score === 'number' && (
      <span className="text-muted-foreground">
        {(vote.score * 100).toFixed(0)}%
      </span>
    )}
  </span>
);

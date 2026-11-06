import {
  decisionLabel,
  decisionTone,
  type DecisionTone,
} from '@/src/framework/decisions/decision_outcome';

const TONE_CLASS: Record<DecisionTone, string> = {
  allow: 'bg-green-500/10 text-green-600 dark:text-green-400',
  block: 'bg-destructive/10 text-destructive',
  // Canceled and unrecognised outcomes are deliberately neutral: no verdict
  // was delivered, so they must read as neither allowed nor blocked.
  canceled: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
};

// The one decision-outcome badge every pact.decisions view renders, so the
// tone mapping lives in a single place. `uppercase` is the audit log's
// louder row style.
export const DecisionBadge = ({
  decision,
  uppercase = false,
  className = 'font-medium',
}: {
  decision: string;
  uppercase?: boolean;
  className?: string;
}) => {
  const label = decisionLabel(decision);

  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-xs ${className} ${TONE_CLASS[decisionTone(decision)]}`}
      data-decision={decisionTone(decision)}
    >
      {uppercase ? label.toUpperCase() : label}
    </span>
  );
};

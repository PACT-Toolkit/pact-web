// Shared rendering for pact.decisions' diagnostics.causal_spans /
// CheckResponse's diagnostics.causal_spans (PACT-734/745): a causal-replay
// byte-range list with no text (PII avoidance by design), so both the audit
// console (AuditDecisionInsights, reading DecisionPayload) and the Test Lab
// layer detail (TestLabLayerDetail, reading LayerState) render it the exact
// same way -- offset-range badges, nothing else. Promoted to framework/ on
// its second use per the shared-code rule rather than kept as two near-
// identical JSX blocks in two feature slices.
export const CausalSpanList = ({
  spans,
  testId,
}: {
  spans: { start?: number; end?: number }[];
  testId?: string;
}) => {
  if (spans.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-xs"
      data-testid={testId}
    >
      <span className="text-muted-foreground">Causal spans</span>
      {spans.map((s, i) => (
        <code
          key={`${s.start}-${s.end}-${i}`}
          className="rounded bg-muted px-1.5 py-0.5"
        >
          chars {s.start}-{s.end}
        </code>
      ))}
    </div>
  );
};

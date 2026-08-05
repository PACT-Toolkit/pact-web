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
  attributed = true,
}: {
  spans: { start?: number; end?: number }[];
  testId?: string;
  // False when the caller could not pin these spans to one pipeline stage
  // (PACT-749, e.g. a cel_rule_fired/policy_token_denied block on the audit
  // feed). Never fabricate a stage name in that case -- render a muted,
  // honest qualifier instead. Defaults to true so every pre-existing caller
  // (and Test Lab, whose layer.causalSpans are only ever set for the one
  // stage that actually blocked) renders byte-identically.
  attributed?: boolean;
}) => {
  if (spans.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-xs"
      data-testid={testId}
    >
      <span className="text-muted-foreground">Causal spans</span>
      {!attributed && (
        <span className="italic text-muted-foreground">
          not attributed to a stage
        </span>
      )}
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

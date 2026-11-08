/**
 * Small badge on a benchmark row the gateway answered by masking content
 * (redaction) instead of blocking it. Same shape as the verdict chip, with a
 * warning tone so a mitigated attack is not read as a plain allow.
 */
export const BenchmarkRedactedBadge = () => (
  <span
    data-testid="benchmark-row-redacted-badge"
    title="The gateway masked content in this prompt instead of blocking it."
    className="rounded-sm bg-warning/15 px-1.5 py-0.5 font-mono text-xs text-warning"
  >
    redacted
  </span>
);

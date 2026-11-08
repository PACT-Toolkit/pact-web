interface BenchmarkMitigatedBadgeProps {
  /** True when the redactor masked content; false when the classifier mitigated the row. */
  redacted: boolean;
}

/**
 * Small badge on a benchmark row the gateway allowed after masking content
 * instead of blocking it. Same shape as the verdict chip, with a warning tone
 * so a mitigated attack is not read as a plain allow. The tooltip names the
 * cause: the redactor, or the classifier's own mitigation.
 */
export const BenchmarkMitigatedBadge = ({
  redacted,
}: BenchmarkMitigatedBadgeProps) => (
  <span
    data-testid="benchmark-row-mitigated-badge"
    title={redacted ? 'content redacted' : 'classifier mitigation'}
    className="rounded-sm bg-warning/15 px-1.5 py-0.5 font-mono text-xs text-warning"
  >
    mitigated
  </span>
);

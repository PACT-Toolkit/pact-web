import { type CheckRedactedSpan } from '@/src/__codegen__/rest/check';

// Placeholder substituted for a redacted span in the ad-hoc test panel's
// masked preview, labelled with the entity type when the gateway reported
// one (e.g. "[REDACTED:EMAIL]"), falling back to a generic marker
// otherwise.
const maskToken = (label?: string) => `[REDACTED${label ? `:${label}` : ''}]`;

// Builds the masked preview of `content` for the redactor test panel.
// pact-gateway's /v1/check response never carries masked content itself
// (see check.RedactorInfo in schema/check/swagger.yaml) -- only a verdict
// plus byte-offset spans -- so the UI derives the preview client-side from
// the original input plus the spans the gateway returned.
//
// Offsets are byte offsets (mirrors AuditDecisionInsights's "bytes N-M"
// treatment of the same shape); this slices by JS string index, which only
// agrees with byte offsets for ASCII content. Non-ASCII input can shift the
// masked boundaries slightly -- an accepted limitation for an ad-hoc test
// panel, not solved here.
export const applyRedaction = (
  content: string,
  spans: CheckRedactedSpan[] | undefined
): string => {
  if (!spans || spans.length === 0) return content;

  // Defensive: sort ascending and drop malformed or overlapping spans so an
  // unexpected gateway response can never throw or corrupt the preview.
  const sorted = [...spans]
    .filter(
      (span) =>
        Number.isFinite(span.start) &&
        Number.isFinite(span.end) &&
        span.end > span.start
    )
    .sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue; // overlaps the previous span; skip

    const start = Math.min(span.start, content.length);
    const end = Math.min(span.end, content.length);
    result += content.slice(cursor, start);
    result += maskToken(span.label);
    cursor = end;
  }
  result += content.slice(cursor);

  return result;
};

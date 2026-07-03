import { type RedactorSpan } from '@/src/app/redactor/domain/redactor_record';

// Compact table of PII spans (entity type + byte offsets), shared by the
// live console's expandable record detail (RedactorRecordCard) and the
// ad-hoc test panel's result (RedactorTestPanel) -- both consume the same
// span shape (RedactorSpan is structurally compatible with the codegen
// CheckRedactedSpan the test panel gets back), so the rendering lives once
// here instead of twice.
export const RedactorSpanList = ({ spans }: { spans: RedactorSpan[] }) => {
  if (spans.length === 0) return null;

  return (
    <table
      className="w-full text-left text-xs"
      data-testid="redactor-span-list"
    >
      <thead>
        <tr className="text-muted-foreground">
          <th className="pb-1 pr-4 font-medium">Entity type</th>
          <th className="pb-1 font-medium">Offsets</th>
        </tr>
      </thead>
      <tbody>
        {spans.map((span, i) => (
          <tr
            key={`${span.label ?? 'span'}-${span.start ?? i}-${span.end ?? i}`}
          >
            <td className="py-0.5 pr-4">
              <code className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                {span.label || 'SPAN'}
              </code>
            </td>
            <td className="py-0.5 font-mono text-muted-foreground">
              {typeof span.start === 'number' && typeof span.end === 'number'
                ? `${span.start}–${span.end}`
                : '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

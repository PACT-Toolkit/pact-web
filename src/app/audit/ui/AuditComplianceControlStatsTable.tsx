import { type AuditControlStatResponse } from '@/src/__codegen__/rest/audit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { DecisionControlBadges } from '@/src/framework/decisions/control_badges';
import { KNOWN_CONTROL_FRAMEWORKS } from '@/src/framework/decisions/control_frameworks';

const frameworkLabel = (framework: string): string =>
  KNOWN_CONTROL_FRAMEWORKS.find((known) => known.value === framework)?.label ??
  framework;

const byTotalDesc = (
  a: AuditControlStatResponse,
  b: AuditControlStatResponse
): number =>
  (b.total ?? 0) - (a.total ?? 0) ||
  `${a.framework}${a.controlId}`.localeCompare(`${b.framework}${b.controlId}`);

export const AuditComplianceControlStatsTable = ({
  stats,
  unmapped,
}: {
  stats: AuditControlStatResponse[];
  unmapped?: AuditControlStatResponse;
}) => {
  const unmappedTotal = unmapped?.total ?? 0;

  if (stats.length === 0 && unmappedTotal === 0) {
    return (
      <p
        className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
        data-testid="audit-compliance-empty"
      >
        No decisions in this window
      </p>
    );
  }

  return (
    <Table data-testid="audit-compliance-stats-table">
      <TableHeader>
        <TableRow>
          <TableHead>Control</TableHead>
          <TableHead>Framework</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Allow</TableHead>
          <TableHead className="text-right">Block</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...stats].sort(byTotalDesc).map((stat) => (
          <TableRow
            key={`${stat.framework}:${stat.controlId}`}
            data-testid="audit-compliance-stat-row"
          >
            <TableCell className="text-xs">
              <DecisionControlBadges
                controls={[
                  { framework: stat.framework ?? '', id: stat.controlId ?? '' },
                ]}
              />
            </TableCell>
            <TableCell>{frameworkLabel(stat.framework ?? '')}</TableCell>
            <TableCell className="text-right tabular-nums">
              {stat.total ?? 0}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {stat.allow ?? 0}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {stat.block ?? 0}
            </TableCell>
          </TableRow>
        ))}
        {unmappedTotal > 0 && (
          <TableRow
            className="text-muted-foreground"
            data-testid="audit-compliance-unmapped-row"
          >
            <TableCell>Unmapped</TableCell>
            <TableCell>No control mapping</TableCell>
            <TableCell className="text-right tabular-nums">
              {unmappedTotal}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {unmapped?.allow ?? 0}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {unmapped?.block ?? 0}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

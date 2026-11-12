'use client';

import { Button } from '@/src/components/ui/button';
import { DateRangeFilter } from '@/src/framework/components/date_range_filter';

export const AuditComplianceWindowPicker = ({
  since,
  until,
  onSinceChange,
  onUntilChange,
  onReset,
}: {
  since: string;
  until: string;
  onSinceChange: (value: string) => void;
  onUntilChange: (value: string) => void;
  onReset: () => void;
}) => (
  <div className="flex flex-wrap items-end gap-2">
    <DateRangeFilter
      since={since}
      until={until}
      onSinceChange={onSinceChange}
      onUntilChange={onUntilChange}
      sinceTestId="audit-compliance-since"
      untilTestId="audit-compliance-until"
      className="w-auto"
    />
    <Button
      type="button"
      variant="outline"
      onClick={onReset}
      data-testid="audit-compliance-reset"
    >
      Last 24 h
    </Button>
  </div>
);

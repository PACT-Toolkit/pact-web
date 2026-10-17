'use client';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

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
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Since
      <Input
        type="datetime-local"
        value={since}
        onChange={(event) => onSinceChange(event.target.value)}
        className="w-56"
        aria-label="Since"
        data-testid="audit-compliance-since"
      />
    </label>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Until
      <Input
        type="datetime-local"
        value={until}
        onChange={(event) => onUntilChange(event.target.value)}
        className="w-56"
        aria-label="Until"
        data-testid="audit-compliance-until"
      />
    </label>
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

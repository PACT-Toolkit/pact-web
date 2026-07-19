'use client';

import { Button } from '@/src/components/ui/button';
import { type Pagination } from '@/src/lib/use_local_pagination';

type PaginationFooterProps = {
  pagination: Pagination;
  // Disables the nav buttons while a fetch is in flight.
  busy?: boolean;
  // Prefixes the emitted testids: `${testIdPrefix}-page-info`,
  // `${testIdPrefix}-page-prev`, `${testIdPrefix}-page-next`.
  testIdPrefix: string;
  // Shown in place of the range line when totalCount is 0, for footers
  // that stay visible on an empty result set (the activity log). Callers
  // that hide the footer entirely when empty (the decisions console
  // shell) never render this.
  emptyText?: string;
};

// The Previous / page X of Y / Next footer every paginated PACT list
// renders: range summary on the left, nav buttons on the right. Works for
// both client-side pagination (useLocalPagination) and server-side paging
// (callers assemble the Pagination shape from their own offset state, as
// AuditWorkbench does).
export const PaginationFooter = ({
  pagination,
  busy = false,
  testIdPrefix,
  emptyText,
}: PaginationFooterProps) => (
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <span data-testid={`${testIdPrefix}-page-info`}>
      {pagination.totalCount > 0
        ? `Showing ${pagination.rangeStart}–${pagination.rangeEnd} of ${pagination.totalCount}`
        : emptyText}
    </span>
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={!pagination.canPrev || busy}
        onClick={pagination.goPrev}
        data-testid={`${testIdPrefix}-page-prev`}
      >
        Previous
      </Button>
      <span>
        Page {pagination.page + 1} of {pagination.totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={!pagination.canNext || busy}
        onClick={pagination.goNext}
        data-testid={`${testIdPrefix}-page-next`}
      >
        Next
      </Button>
    </div>
  </div>
);

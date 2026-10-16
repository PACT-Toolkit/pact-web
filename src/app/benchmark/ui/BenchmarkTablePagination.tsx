import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/src/components/ui/button';

interface BenchmarkTablePaginationProps {
  /** Zero-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Previous/next controls under a paged benchmark rows table. */
export const BenchmarkTablePagination = ({
  page,
  pageCount,
  onPageChange,
}: BenchmarkTablePaginationProps) => (
  <nav
    aria-label="Table pagination"
    className="flex items-center justify-end gap-2 border-t px-4 py-2"
  >
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPageChange(page - 1)}
      disabled={page === 0}
      aria-label="Previous page"
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span
      aria-live="polite"
      aria-atomic="true"
      className="text-xs text-muted-foreground"
    >
      {page + 1} / {pageCount}
    </span>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPageChange(page + 1)}
      disabled={page >= pageCount - 1}
      aria-label="Next page"
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  </nav>
);

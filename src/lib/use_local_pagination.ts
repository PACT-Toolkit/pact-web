import { useMemo, useState } from 'react';

// Presentation-facing pagination contract: everything a footer or shell
// needs to render "Showing X-Y of N" plus Previous/Next controls, without
// caring whether the pages are sliced client-side (useLocalPagination) or
// fetched server-side (a caller assembling this shape by hand).
export type Pagination = {
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  canPrev: boolean;
  canNext: boolean;
  goPrev: () => void;
  goNext: () => void;
};

export type LocalPagination<T> = Pagination & { pageItems: T[] };

// Client-side pagination over an already-fetched array. The current page
// is clamped into range instead of asking callers to reset it: a refresh
// or a narrowed filter can shrink `items` below the current offset, and
// clamping keeps the user on the nearest valid page rather than stranding
// them past the end.
export const useLocalPagination = <T>(
  items: readonly T[],
  pageSize: number
): LocalPagination<T> => {
  const [rawPage, setRawPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(rawPage, totalPages - 1);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, (page + 1) * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    totalPages,
    totalCount: items.length,
    rangeStart: page * pageSize + 1,
    rangeEnd: Math.min(items.length, (page + 1) * pageSize),
    canPrev: page > 0,
    canNext: page + 1 < totalPages,
    goPrev: () => setRawPage(Math.max(0, page - 1)),
    goNext: () => setRawPage(page + 1),
    pageItems,
  };
};

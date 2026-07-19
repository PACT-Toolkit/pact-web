'use client';

import { type ReactNode } from 'react';

import { PaginationFooter } from '@/src/components/pagination-footer';
import { RefreshButton } from '@/src/components/refresh-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { type Pagination } from '@/src/lib/use_local_pagination';

type DecisionsConsoleShellProps = {
  // Stage token: prefixes every data-testid this shell emits
  // (`${stage}-workbench`, `${stage}-empty-state`, `${stage}-record-list`,
  // `${stage}-page-info`, `${stage}-page-prev`, `${stage}-page-next`).
  stage: string;
  title: string;
  description: ReactNode;
  // Extra header content below the title row -- a summary count line
  // and/or filter controls, styled by the caller.
  headerExtra?: ReactNode;
  error: boolean;
  errorText: string;
  isLoading: boolean;
  loadingText: string;
  emptyText: ReactNode;
  // Overrides the default `${stage}-empty-state` testid, for consoles that
  // distinguish "nothing loaded" from "nothing matches the active filter".
  emptyStateTestId?: string;
  isValidating: boolean;
  onRefresh: () => void;
  pagination: Pagination;
  // The current page of rows, already keyed by the caller.
  children: ReactNode;
};

// The one pact.decisions console card, written once for the four stage
// consoles (filter, consensus, classifier, redactor): header with title +
// refresh button, error / loading / empty states, the row list, and the
// pagination footer. Each feature keeps a thin feature-prefixed wrapper
// that pairs this shell with useDecisionsWindow + its stage's record
// extraction, so the stage-specific lens stays in the feature slice and
// the chrome lives here.
export const DecisionsConsoleShell = ({
  stage,
  title,
  description,
  headerExtra,
  error,
  errorText,
  isLoading,
  loadingText,
  emptyText,
  emptyStateTestId,
  isValidating,
  onRefresh,
  pagination,
  children,
}: DecisionsConsoleShellProps) => {
  const isEmpty = pagination.totalCount === 0;

  return (
    <Card data-testid={`${stage}-workbench`}>
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <RefreshButton onRefresh={onRefresh} busy={isValidating} />
        </div>
        {headerExtra}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorText}
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">{loadingText}</p>
        )}

        {!error && !isLoading && isEmpty && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid={emptyStateTestId ?? `${stage}-empty-state`}
          >
            {emptyText}
          </p>
        )}

        {!isEmpty && (
          <div
            className="flex flex-col divide-y rounded-md border"
            data-testid={`${stage}-record-list`}
          >
            {children}
          </div>
        )}

        {!isEmpty && (
          <PaginationFooter
            pagination={pagination}
            busy={isValidating}
            testIdPrefix={stage}
          />
        )}
      </CardContent>
    </Card>
  );
};

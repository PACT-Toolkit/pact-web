'use client';

import { Lock, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';

import {
  useAnnotateDecision,
  useQueryAuditEvents,
  type AuditEvent,
  type ListDecisionAnnotationsResponse,
} from '@/src/__codegen__/rest/audit';
import { useLabelVerdict } from '@/src/__codegen__/rest/classifier';
import {
  PAGE_SIZE,
  parsePayload,
  type DecisionPayload,
} from '@/src/app/filter/domain/filter_decision';
import { useFilterDecisionStats } from '@/src/app/filter/domain/filter_decision_stats';
import {
  applyOptimisticAnnotationFlag,
  buildAnnotateDecisionRequest,
  buildDecisionAnnotationsQueryKey,
  buildFilterFalsePositiveLabelRequest,
  extractFlaggedFalsePositiveRequestIds,
  fetchDecisionAnnotations,
  isFlaggedFalsePositive,
  resolveFlagRequestId,
} from '@/src/app/filter/domain/filter_false_positive';
import { FilterDecisionRow } from '@/src/app/filter/ui/FilterDecisionRow';
import { FilterPacksPanel } from '@/src/app/filter/ui/FilterPacksPanel';
import { FilterStatCard } from '@/src/app/filter/ui/FilterStatCard';
import { FilterTestRuleSandbox } from '@/src/app/filter/ui/FilterTestRuleSandbox';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

export const FilterDecisionsWorkbench = () => {
  const [localPage, setLocalPage] = useState(0);
  const [flaggingEventId, setFlaggingEventId] = useState<string | null>(null);
  const [failedEventIds, setFailedEventIds] = useState<Set<string>>(new Set());

  const params = useMemo(
    () => ({
      topic: 'pact.decisions',
      limit: 200,
    }),
    []
  );

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const { trigger: submitFalsePositiveLabel } = useLabelVerdict();
  const { trigger: submitAnnotateDecision } = useAnnotateDecision();

  const allEvents: AuditEvent[] = useMemo(
    () => (data?.status === 200 ? data.data.events : []),
    [data]
  );

  const {
    total,
    filter: filterStats,
    error: statsError,
    forbidden: statsForbidden,
  } = useFilterDecisionStats();
  const allowed = total - filterStats.blocked;
  const maxRuleCount = filterStats.top_rules[0]?.count ?? 1;

  const totalPages = Math.max(1, Math.ceil(allEvents.length / PAGE_SIZE));
  const pageEvents = allEvents.slice(
    localPage * PAGE_SIZE,
    (localPage + 1) * PAGE_SIZE
  );

  // One batched read per page of visible rows (PACT-474), not one read per
  // row -- gathers every distinct requestId currently on screen and looks
  // them all up in a single POST /v1/audit/annotations/query call.
  const pageRequestIds = useMemo(() => {
    const ids = pageEvents
      .map((evt) => resolveFlagRequestId(evt, parsePayload(evt.payloadJson)))
      .filter((id): id is string => Boolean(id));

    return Array.from(new Set(ids)).sort();
  }, [pageEvents]);

  const annotationsKey = useMemo(
    () => buildDecisionAnnotationsQueryKey(pageRequestIds),
    [pageRequestIds]
  );

  const { data: annotationsData, mutate: mutateAnnotations } =
    useSWR<ListDecisionAnnotationsResponse>(
      annotationsKey,
      fetchDecisionAnnotations,
      { revalidateOnFocus: false }
    );

  const flaggedRequestIds = useMemo(
    () => extractFlaggedFalsePositiveRequestIds(annotationsData),
    [annotationsData]
  );

  // Persists a "false positive" flag two ways (PACT-474): a durable
  // annotation via gateway's POST /v1/audit/annotations (PACT-464 proxy),
  // which is what backs the row's flagged state, and the pre-existing
  // POST /v1/classifier/label write (PACT-318/PACT-325) that feeds
  // pact-classifier's fine-tune corpus -- a distinct purpose, kept as-is.
  // Optimistically inserts into the annotations cache before either request
  // settles; rolls back on failure. See filter_false_positive.ts's docblock
  // for why this is a one-way action -- there is no un-flag endpoint.
  const handleFlagFP = async (
    event: AuditEvent,
    payload: DecisionPayload | null
  ) => {
    const requestId = resolveFlagRequestId(event, payload);
    if (
      !requestId ||
      isFlaggedFalsePositive(flaggedRequestIds, requestId) ||
      flaggingEventId === event.id ||
      !annotationsKey
    ) {
      return;
    }

    setFlaggingEventId(event.id);
    setFailedEventIds((prev) => {
      if (!prev.has(event.id)) return prev;
      const next = new Set(prev);
      next.delete(event.id);

      return next;
    });

    const submit = async (): Promise<
      ListDecisionAnnotationsResponse | undefined
    > => {
      const [labelResponse, annotateResponse] = await Promise.all([
        submitFalsePositiveLabel(
          buildFilterFalsePositiveLabelRequest(requestId, payload)
        ),
        submitAnnotateDecision(buildAnnotateDecisionRequest(requestId)),
      ]);
      if (labelResponse.status !== 200) {
        throw new Error(
          `label verdict request failed (${labelResponse.status})`
        );
      }
      if (annotateResponse.status !== 200) {
        throw new Error(
          `annotate decision request failed (${annotateResponse.status})`
        );
      }

      return undefined;
    };

    try {
      await mutateAnnotations(submit(), {
        optimisticData: (current) =>
          applyOptimisticAnnotationFlag(current, requestId),
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      });
    } catch {
      setFailedEventIds((prev) => new Set(prev).add(event.id));
    } finally {
      setFlaggingEventId((prev) => (prev === event.id ? null : prev));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterPacksPanel />
      <FilterTestRuleSandbox />

      {statsForbidden ? (
        <p className="flex items-center gap-1.5 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Insufficient permissions to view decision stats.
        </p>
      ) : (
        <>
          {statsError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load decision stats. Try refreshing in a moment.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FilterStatCard label="Total decisions" value={total} />
            <FilterStatCard
              label="Blocked"
              value={filterStats.blocked}
              valueClass="text-destructive"
            />
            <FilterStatCard label="Allowed" value={allowed} />
            <FilterStatCard
              label="Block rate"
              value={`${filterStats.block_rate.toFixed(1)}%`}
              valueClass={
                filterStats.block_rate > 10 ? 'text-destructive' : undefined
              }
            />
          </div>

          {filterStats.top_rules.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top blocked rules</CardTitle>
                <CardDescription>
                  Rules with the highest block counts across all decisions.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {filterStats.top_rules.map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                      {label}
                    </span>
                    <div className="flex flex-1 items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-destructive/70"
                        style={{
                          width: `${(count / maxRuleCount) * 100}%`,
                          minWidth: '4px',
                        }}
                      />
                      <span className="tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Recent decisions</CardTitle>
              <CardDescription>
                Newest first, auto-refreshes every 30 s. Flag a blocked decision
                as a false positive to track misclassifications.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
              disabled={isValidating}
            >
              <RefreshCw
                className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load decisions. Try refreshing in a moment.
            </p>
          )}

          {!error && !isLoading && allEvents.length === 0 && (
            <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              No filter decisions recorded yet.
            </p>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading decisions…</p>
          )}

          {pageEvents.length > 0 && (
            <div className="flex flex-col divide-y rounded-md border">
              {pageEvents.map((evt) => {
                const payload = parsePayload(evt.payloadJson);
                const requestId = resolveFlagRequestId(evt, payload);

                return (
                  <FilterDecisionRow
                    key={evt.id}
                    event={evt}
                    isFlagged={isFlaggedFalsePositive(
                      flaggedRequestIds,
                      requestId
                    )}
                    isFlagging={flaggingEventId === evt.id}
                    flagFailed={failedEventIds.has(evt.id)}
                    onFlagFP={() => void handleFlagFP(evt, payload)}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {allEvents.length > 0
                ? `Showing ${localPage * PAGE_SIZE + 1}–${Math.min(allEvents.length, (localPage + 1) * PAGE_SIZE)} of ${allEvents.length}`
                : 'No matching rows'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={localPage === 0 || isValidating}
                onClick={() => setLocalPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span>
                Page {localPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={localPage + 1 >= totalPages || isValidating}
                onClick={() => setLocalPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

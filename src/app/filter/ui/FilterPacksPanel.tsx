'use client';

import { Layers } from 'lucide-react';
import { useMemo } from 'react';

import { useListLoadedPacks } from '@/src/__codegen__/rest/filter';
import {
  engineKindLabel,
  packSourceBadgeClass,
  packSourceLabel,
  sortPacksByLoadedAt,
} from '@/src/app/filter/domain/filter_packs';
import { RefreshButton } from '@/src/components/refresh-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { formatTimestamp } from '@/src/lib/format_timestamp';

// Loaded rule packs / engines view (pact-gateway PACT-450's GET
// /v1/filter/packs, wired here under PACT-325 part 1). Lets an operator see
// which rule packs and engines pact-filter actually has active without
// SSHing into a pod. Read-only, not user-scoped -- every authenticated
// caller sees the same set.
export const FilterPacksPanel = () => {
  const { data, error, isLoading, isValidating, mutate } = useListLoadedPacks({
    swr: { revalidateOnFocus: false },
  });

  const packs = useMemo(
    () => (data?.status === 200 ? sortPacksByLoadedAt(data.data.packs) : []),
    [data]
  );
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" aria-hidden />
              Loaded rule packs
            </CardTitle>
            <CardDescription>
              Rule packs and engines currently active in pact-filter, from GET
              /v1/filter/packs.
            </CardDescription>
          </div>
          <RefreshButton
            onRefresh={() => void mutate()}
            busy={isValidating}
            testId="filter-packs-refresh"
          />
        </div>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-3"
        data-testid="filter-packs-panel"
      >
        {requestFailed && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load rule packs. Try refreshing in a moment.
          </p>
        )}

        {isLoading && !requestFailed && (
          <p className="text-sm text-muted-foreground">
            Loading loaded rule packs…
          </p>
        )}

        {!isLoading && !requestFailed && packs.length === 0 && (
          <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            No rule packs are currently loaded.
          </p>
        )}

        {packs.length > 0 && (
          <div className="flex flex-col divide-y rounded-md border">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
                data-testid="filter-packs-row"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{pack.name}</span>
                    {pack.version && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {pack.version}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Loaded {formatTimestamp(pack.loadedAt, 'compact')}
                    {pack.ruleCount !== undefined
                      ? ` · ${pack.ruleCount} rules`
                      : ''}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">
                    {engineKindLabel(pack.engineKind)}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${packSourceBadgeClass(pack.source)}`}
                  >
                    {packSourceLabel(pack.source)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

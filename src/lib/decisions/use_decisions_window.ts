import { useMemo } from 'react';

import {
  useQueryAuditEvents,
  type AuditEvent,
} from '@/src/__codegen__/rest/audit';

// Size of the single SWR fetch window shared by every pact.decisions
// console -- server-side clamp is 200 (audit.Service.MaxLimit) and 30s
// matches the app-wide live-feed refresh. Distinct from each console's
// PAGE_SIZE, which paginates the already-fetched window client-side.
const FETCH_WINDOW_SIZE = 200;
const REFRESH_INTERVAL_MS = 30_000;

// The one fetch window over the pact.decisions audit feed that every
// stage console (filter, consensus, classifier, redactor) renders a lens
// over. All four consoles show the same events filtered to their stage's
// payload sub-object -- same topic, same window size, same refresh
// cadence -- so the SWR call lives here once and the consoles stay pure
// presentation over `events`.
export const useDecisionsWindow = () => {
  const params = useMemo(
    () => ({
      topic: 'pact.decisions',
      limit: FETCH_WINDOW_SIZE,
    }),
    []
  );

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        refreshInterval: REFRESH_INTERVAL_MS,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const events: AuditEvent[] = useMemo(
    () => (data?.status === 200 ? data.data.events : []),
    [data]
  );

  return {
    events,
    error: Boolean(error),
    isLoading,
    isValidating,
    refresh: () => {
      void mutate();
    },
  };
};

import useSWR from 'swr';

import { type PolicyEventsResponse } from '@/src/app/policy/domain/policy_event';

const fetcher = (url: string): Promise<PolicyEventsResponse> =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    return r.json() as Promise<PolicyEventsResponse>;
  });

export const usePolicyEvents = () =>
  useSWR<PolicyEventsResponse>('/v1/audit/policy-events', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

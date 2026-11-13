import { useState } from 'react';
import { useSWRConfig } from 'swr';

import {
  type BenchmarkAdaptiveCampaignBody,
  getGetAdaptiveCampaignKey,
  useGetAdaptiveCampaign,
  useListAdaptiveCampaigns,
} from '@/src/__codegen__/rest/benchmark';
import {
  ADAPTIVE_CAMPAIGN_LIST_LIMIT,
  adaptiveRefreshInterval,
  isCampaignRunning,
} from '@/src/app/benchmark/domain/benchmark_adaptive_campaign';

// A module-level constant keeps the SWR key referentially stable.
const LIST_PARAMS = { limit: ADAPTIVE_CAMPAIGN_LIST_LIMIT };

const campaignsOf = (
  data: ReturnType<typeof useListAdaptiveCampaigns>['data']
): BenchmarkAdaptiveCampaignBody[] =>
  data?.status === 200 ? (data.data.campaigns ?? []) : [];

/**
 * The recent campaigns (newest first) and the one shown. The shown campaign
 * is the user's pick, defaulting to the newest. Both reads poll every few
 * seconds while their own campaign runs and stop once it is terminal: the
 * interval is derived from the latest data, never from a timer.
 */
export function useBenchmarkAdaptiveCampaigns() {
  const [pickedId, setPickedId] = useState<string | null>(null);

  const { mutate: mutateKey } = useSWRConfig();

  const list = useListAdaptiveCampaigns(LIST_PARAMS, {
    swr: {
      revalidateOnFocus: false,
      // The list can see a campaign finish before the detail poll does. Pull
      // the detail now so the badge and result never lag behind the picker.
      onSuccess: (data) => {
        const latest = campaignsOf(data)[0];
        if (latest && !isCampaignRunning(latest.status)) {
          void mutateKey(getGetAdaptiveCampaignKey(latest.id));
        }
      },
      refreshInterval: (data) => adaptiveRefreshInterval(campaignsOf(data)[0]),
    },
  });
  const campaigns = campaignsOf(list.data);
  const newest = campaigns[0];
  const shownId = pickedId ?? newest?.id ?? null;

  const detail = useGetAdaptiveCampaign(shownId ?? '', {
    swr: {
      enabled: shownId !== null,
      revalidateOnFocus: false,
      refreshInterval: (data) =>
        adaptiveRefreshInterval(data?.status === 200 ? data.data : undefined),
    },
  });

  const shown =
    shownId !== null && detail.data?.status === 200
      ? detail.data.data
      : undefined;

  return {
    campaigns,
    /** The newest campaign; the running gate reads it. */
    newest,
    shownId,
    shown,
    isLoading: list.isLoading || (shownId !== null && detail.isLoading),
    // The generated fetchers resolve for every HTTP status, so a non-200 is
    // an error here, not an empty list.
    listFailed:
      list.error !== undefined ||
      (list.data !== undefined && list.data.status !== 200),
    detailFailed:
      detail.error !== undefined ||
      (detail.data !== undefined && detail.data.status !== 200),
    pick: setPickedId,
    revalidateList: list.mutate,
  };
}

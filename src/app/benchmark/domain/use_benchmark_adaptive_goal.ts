import { useGetAdaptiveCampaignGoal } from '@/src/__codegen__/rest/benchmark';

/**
 * One goal with its attempt transcript. The request goes out only while a
 * goal is open: a null goal id disables the read, so a closed transcript
 * costs nothing.
 */
export function useBenchmarkAdaptiveGoal(
  campaignId: string | null,
  goalId: string | null
) {
  const enabled = campaignId !== null && goalId !== null;
  const { data, error, isLoading } = useGetAdaptiveCampaignGoal(
    campaignId ?? '',
    goalId ?? '',
    { swr: { enabled, revalidateOnFocus: false } }
  );

  return {
    goal: data?.status === 200 ? data.data : undefined,
    isLoading: enabled && isLoading,
    failed:
      enabled &&
      (error !== undefined || (data !== undefined && data.status !== 200)),
  };
}

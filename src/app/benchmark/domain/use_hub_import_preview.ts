import { useMemo, useState } from 'react';

import {
  useInspectBenchmarkImport,
  type InspectBenchmarkImportQueryResult,
} from '@/src/__codegen__/rest/benchmark';
import {
  buildPreviewParams,
  describeHubImportError,
  hubDatasetIdentityKey,
  type HubDatasetIdentity,
  type HubDatasetPreview,
} from '@/src/app/benchmark/domain/benchmark_import';

interface HeldResponse {
  datasetKey: string;
  response: InspectBenchmarkImportQueryResult;
}

interface HubImportPreviewState {
  /** The preview of the inspected dataset; absent while loading or on error. */
  preview: HubDatasetPreview | undefined;
  /** A display-ready message when the gateway rejected the preview request. */
  errorMessage: string | undefined;
  /** First load of a dataset: nothing of it has been shown yet. */
  isLoading: boolean;
  /** A request is in flight, including a refetch over a preview still shown. */
  isValidating: boolean;
}

/**
 * Previews the Hub dataset `identity` names, sliced by the label column and
 * score threshold the user picked.
 *
 * While a changed threshold or label column refetches, the preview of the
 * same dataset stays in place (`isValidating` marks the window) so the card
 * and the focused threshold input do not unmount. A different dataset never
 * borrows the previous one's preview: once the identity changes there is no
 * preview until the new response arrives. SWR's `keepPreviousData` cannot
 * make that distinction (it holds the last data for any key change), so the
 * last response is held here together with the dataset it belongs to.
 */
export function useHubImportPreview(
  identity: HubDatasetIdentity | null,
  labelColumnSelection: string | null,
  scoreThresholdOverride: number | null
): HubImportPreviewState {
  const params = useMemo(
    () =>
      identity
        ? buildPreviewParams(
            identity,
            labelColumnSelection,
            scoreThresholdOverride
          )
        : null,
    [identity, labelColumnSelection, scoreThresholdOverride]
  );
  const datasetKey = identity ? hubDatasetIdentityKey(identity) : null;

  const { data, isLoading, isValidating } = useInspectBenchmarkImport(
    params ?? { slug: '' },
    { swr: { enabled: params !== null, revalidateOnFocus: false } }
  );

  // Adjusting state while rendering (not in an effect) is React's pattern for
  // remembering the previous render's value; the re-render is immediate.
  const [held, setHeld] = useState<HeldResponse | null>(null);
  if (
    datasetKey !== null &&
    data !== undefined &&
    (held?.datasetKey !== datasetKey || held.response !== data)
  ) {
    setHeld({ datasetKey, response: data });
  }

  const response =
    data ?? (held?.datasetKey === datasetKey ? held?.response : undefined);

  return {
    preview: response?.status === 200 ? response.data : undefined,
    errorMessage:
      response && response.status !== 200
        ? describeHubImportError(response.status, response.data)
        : undefined,
    isLoading: isLoading && response === undefined,
    isValidating,
  };
}

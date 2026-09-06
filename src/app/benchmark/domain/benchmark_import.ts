import {
  type BenchmarkBenchmarkImportPreviewResponse as HubDatasetPreview,
  type BenchmarkBenchmarkImportRequest,
  type BenchmarkBenchmarkImportRequestLabelValues as HubImportLabelValues,
  type InspectBenchmarkImportParams as HubImportPreviewParams,
} from '@/src/__codegen__/rest/benchmark';
import {
  matchLabelVocabulary,
  type DistinctLabelValuesOutcome,
  type LabelDecision,
} from '@/src/app/benchmark/domain/benchmark_corpus_mapping';
import { extractServerErrorMessage } from '@/src/framework/http';

// Hub import wire types are generated from the gateway's per-tag swagger
// slice (schema/benchmark, pulled from pact-gateway). The generated names
// carry the Go package + struct prefix; alias them to the domain vocabulary
// so the feature imports stable types from the domain layer, not the
// codegen folder.
export type {
  BenchmarkBenchmarkHubImportSummary as HubImportSummary,
  BenchmarkBenchmarkImportPreviewResponse as HubDatasetPreview,
  BenchmarkBenchmarkImportRequestLabelValues as HubImportLabelValues,
  InspectBenchmarkImportParams as HubImportPreviewParams,
} from '@/src/__codegen__/rest/benchmark';

/** `POST /v1/benchmark/imports`'s body, minus `gateway_url` - the workbench
 * (not this card) owns the gateway address, the same split of
 * responsibility as `submitBenchmarkJob`'s caller in BenchmarkWorkbench. */
export type HubImportRequestDraft = Omit<
  BenchmarkBenchmarkImportRequest,
  'gateway_url'
>;

/** The user-editable identity of a dataset to preview/import: which hub
 * split/config/revision to read. Independent of the column mapping chosen
 * once a preview comes back. */
export interface HubDatasetIdentity {
  slug: string;
  split: string;
  config: string;
  revision: string;
}

/**
 * Renders a non-2xx response from either import endpoint into a display
 * string. 403 and 404 get a fixed, friendlier message than the gateway's own
 * `boundary.ErrorResponse` text (both endpoints share these two meanings:
 * gated dataset, and dataset/config/split not found); every other status
 * falls back to `extractServerErrorMessage`. Shared between
 * `BenchmarkImportCard` (preview errors) and `BenchmarkWorkbench` (import
 * submission errors) - same contract, same two special cases, one place to
 * keep them in sync if the gateway ever changes what a 403/404 means here.
 */
export function describeHubImportError(
  status: number,
  data: string | { code?: string; error?: string } | undefined
): string {
  if (status === 403) {
    return 'This dataset is gated - the benchmark service has no access to it.';
  }
  if (status === 404) {
    return 'Dataset, config, or split not found.';
  }

  return extractServerErrorMessage(data) ?? 'The gateway returned an error.';
}

/**
 * Builds `GET /v1/benchmark/imports/preview`'s query params from a dataset
 * identity plus the currently-selected label column override. Blank
 * identity fields are omitted rather than sent empty - the gateway only
 * applies its own defaults (split "train", alias-detected label column) when
 * the param is absent entirely.
 */
export function buildPreviewParams(
  identity: HubDatasetIdentity,
  labelColumnOverride: string | null
): HubImportPreviewParams {
  const params: HubImportPreviewParams = { slug: identity.slug.trim() };
  if (identity.split.trim()) params.split = identity.split.trim();
  if (identity.config.trim()) params.config = identity.config.trim();
  if (identity.revision.trim()) params.revision = identity.revision.trim();
  if (labelColumnOverride) params.label_column = labelColumnOverride;

  return params;
}

/**
 * Converts a preview's already-deduplicated label values into the same
 * `DistinctLabelValuesOutcome` shape the upload flow's mapping UI expects,
 * so `BenchmarkUploadMapping` can be reused unchanged. Returns `null` when
 * the preview found no label column (empty `detected_label_column`) - the
 * card falls back to an explicit "assume every row is..." control instead of
 * a per-value mapping grid in that case.
 *
 * Unlike the upload flow's `computeDistinctLabelValues`, this never reports
 * `ok: false` for "too many distinct values": the gateway already caps
 * `label_values` at 20 and signals an over-cap sample with
 * `label_values_truncated` rather than an error - there is always a valid
 * (if partial) list to show.
 */
export function previewToDistinctValues(
  preview: HubDatasetPreview
): DistinctLabelValuesOutcome | null {
  if (!preview.detected_label_column) return null;

  const defaultDecisions: Record<string, LabelDecision> = {};
  for (const value of preview.label_values) {
    defaultDecisions[value] = matchLabelVocabulary(value);
  }

  return { ok: true, values: preview.label_values, defaultDecisions };
}

/**
 * Normalizes a raw label-value key the way the gateway does before matching
 * it in `BenchmarkImportRequest.label_values` ("trimmed, lowercased" per the
 * wire contract). `previewToDistinctValues` already sources its keys
 * pre-normalized from the preview response, so this only matters as a
 * defensive boundary in `buildImportRequest` - kept here, and exported, so
 * that guarantee is tested directly rather than assumed.
 */
export function normalizeLabelValueKey(value: string): string {
  return value.trim().toLowerCase();
}

export interface BuildImportRequestArgs {
  identity: HubDatasetIdentity;
  textColumn: string | null;
  labelColumn: string | null;
  valueDecisions: Record<string, LabelDecision>;
  assumeLabel: 'allow' | 'block' | null;
}

/**
 * Builds `POST /v1/benchmark/imports`'s body (minus `gateway_url`) from the
 * import card's form state. `label_values` keys are normalized on the way
 * out even though the mapping grid's keys already come pre-normalized from
 * `previewToDistinctValues` - if two distinct raw keys ever collapsed to the
 * same normalized key, the later entry in `Object.entries` iteration order
 * (insertion order for string keys) wins, matching plain-object
 * last-write-wins semantics used elsewhere in the mapping helpers.
 */
export function buildImportRequest(
  args: BuildImportRequestArgs
): HubImportRequestDraft {
  const { identity, textColumn, labelColumn, valueDecisions, assumeLabel } =
    args;

  const label_values: HubImportLabelValues = {};
  for (const [rawValue, decision] of Object.entries(valueDecisions)) {
    label_values[normalizeLabelValueKey(rawValue)] = decision;
  }

  return {
    slug: identity.slug.trim(),
    ...(identity.split.trim() ? { split: identity.split.trim() } : {}),
    ...(identity.config.trim() ? { config: identity.config.trim() } : {}),
    ...(identity.revision.trim() ? { revision: identity.revision.trim() } : {}),
    ...(textColumn ? { text_column: textColumn } : {}),
    ...(labelColumn ? { label_column: labelColumn } : {}),
    ...(Object.keys(label_values).length > 0 ? { label_values } : {}),
    ...(assumeLabel ? { assume_label: assumeLabel } : {}),
  };
}

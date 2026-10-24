import {
  type BenchmarkBenchmarkImportPreviewResponse as HubDatasetPreview,
  type BenchmarkBenchmarkImportRequest,
  type BenchmarkBenchmarkImportRequestLabelValues as HubImportLabelValues,
  type InspectBenchmarkImportParams as HubImportPreviewParams,
} from '@/src/__codegen__/rest/benchmark';
import {
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
 * A stable string for "which dataset is this": the trimmed slug, split,
 * config and revision, normalized exactly as `buildPreviewParams` sends them,
 * so two identities that produce the same preview request share a key. The
 * column mapping and score threshold are deliberately not part of it - they
 * re-slice the same dataset, while a different key means different data.
 */
export function hubDatasetIdentityKey(identity: HubDatasetIdentity): string {
  return JSON.stringify([
    identity.slug.trim(),
    identity.split.trim(),
    identity.config.trim(),
    identity.revision.trim(),
  ]);
}

/**
 * Renders a non-2xx response from either import endpoint into a display
 * string. 403, 404, and 504 get a fixed, friendlier message than the
 * gateway's own `boundary.ErrorResponse` text (the three meanings shared by
 * both endpoints: gated dataset, dataset/config/split not found, and the
 * gateway's global request-timeout middleware aborting a cold Hub read);
 * every other status falls back to `extractServerErrorMessage`. Shared
 * between `BenchmarkImportCard` (preview errors) and `BenchmarkWorkbench`
 * (import submission errors) - same contract, same special cases, one place
 * to keep them in sync if the gateway ever changes what these statuses mean
 * here.
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
  if (status === 504) {
    return 'The dataset took too long to inspect. Try again - the first read of a dataset can be slow.';
  }

  return extractServerErrorMessage(data) ?? 'The gateway returned an error.';
}

/**
 * Sentinel for the label-column select's "No label column" entry. Radix
 * Select reserves the empty string for "no selection / show placeholder", so
 * the explicit "this dataset has no label column" choice needs a non-empty
 * value that can never collide with a real column name in practice.
 */
export const NO_LABEL_COLUMN = '__none__';

/**
 * Builds `GET /v1/benchmark/imports/preview`'s query params from a dataset
 * identity plus the user's label column selection (a real column, the
 * `NO_LABEL_COLUMN` sentinel, or `null` for "untouched"). Blank identity
 * fields are omitted rather than sent empty - the gateway only applies its
 * own defaults (split "train", detected label column) when the param is
 * absent entirely. The sentinel is omitted too: the preview then matches the
 * untouched one (same cache entry), and `resolveHubImportMapping` ignores the
 * detected label column for it. The score column and threshold are sent
 * together or not at all, as `buildImportRequest` does: only once the user
 * committed a threshold (`null` = untouched, the server uses its suggestion)
 * and a score column is in effect (`null` = none resolved, so a threshold has
 * nothing to apply to). `0` is a real threshold, so the check is `!== null`,
 * not truthiness.
 */
export function buildPreviewParams(
  identity: HubDatasetIdentity,
  labelColumnSelection: string | null,
  scoreColumn: string | null,
  scoreThreshold: number | null
): HubImportPreviewParams {
  const params: HubImportPreviewParams = { slug: identity.slug.trim() };
  if (identity.split.trim()) params.split = identity.split.trim();
  if (identity.config.trim()) params.config = identity.config.trim();
  if (identity.revision.trim()) params.revision = identity.revision.trim();
  if (labelColumnSelection && labelColumnSelection !== NO_LABEL_COLUMN) {
    params.label_column = labelColumnSelection;
  }
  if (scoreColumn !== null && scoreThreshold !== null) {
    params.score_column = scoreColumn;
    params.score_threshold = scoreThreshold;
  }

  return params;
}

/**
 * Normalizes a hub preview's `detected_text_column` / `detected_label_column`
 * to `null` when the gateway reports "not detected" as an empty (or
 * whitespace-only) string - both fields are typed as plain `string`, not
 * `string | null`, so the "not detected" sentinel is `""`. A bare `?? null`
 * chain over that value treats `""` as a present column, which is how
 * `canRun` used to go true with no text column actually chosen.
 * Every reader of these two fields goes through this so the "" -> null
 * contract can't drift between them.
 */
export function normalizeDetectedColumn(
  value: string | undefined
): string | null {
  return value && value.trim().length > 0 ? value : null;
}

/** The user's raw choices on the import card; `null` means "untouched, use
 * what the preview detected". */
export interface HubImportSelections {
  textColumn: string | null;
  /** A real column name, `NO_LABEL_COLUMN`, or `null`. */
  labelColumn: string | null;
  assumeLabel: 'allow' | 'block' | null;
  /** The user's committed score threshold; `null` = untouched. */
  scoreThreshold: number | null;
}

/** The mapping the card actually shows and submits, plus which parts came
 * from the preview rather than from the user. */
export interface ResolvedHubImportMapping {
  textColumn: string | null;
  labelColumn: string | null;
  /** The numeric score column the preview resolved; always `null` while
   * `labelColumn` is set (the label column wins server-side). */
  scoreColumn: string | null;
  /** The threshold shown and submitted; non-null only with `scoreColumn`. */
  scoreThreshold: number | null;
  /** Non-null only while neither a label column nor a score column is in
   * effect - exactly one of the three labelling paths is active. */
  assumeLabel: 'allow' | 'block' | null;
  textColumnAutoDetected: boolean;
  labelColumnAutoDetected: boolean;
  assumeLabelAutoDetected: boolean;
  scoreThresholdAutoDetected: boolean;
}

function toAssumeLabel(value: string | undefined): 'allow' | 'block' | null {
  return value === 'allow' || value === 'block' ? value : null;
}

/**
 * Layers the user's selections over the preview's detections: a user choice
 * always wins, the `NO_LABEL_COLUMN` sentinel clears the label column even
 * when one was detected, and the assume-label falls back to the gateway's
 * `suggested_assume_label`. Import precedence mirrors the server: label
 * column, then score column, then assume-label. Pure derived state - the card keeps only the
 * user's raw choices.
 */
export function resolveHubImportMapping(
  preview: HubDatasetPreview | undefined,
  selections: HubImportSelections
): ResolvedHubImportMapping {
  const detectedText = normalizeDetectedColumn(preview?.detected_text_column);
  const detectedLabel = normalizeDetectedColumn(preview?.detected_label_column);
  const suggestedAssume = toAssumeLabel(preview?.suggested_assume_label);

  const labelColumn =
    selections.labelColumn === NO_LABEL_COLUMN
      ? null
      : (selections.labelColumn ?? detectedLabel);

  const scoreColumn =
    labelColumn === null
      ? normalizeDetectedColumn(preview?.score_column)
      : null;
  const scoreThreshold =
    scoreColumn === null
      ? null
      : (selections.scoreThreshold ?? preview?.suggested_threshold ?? null);

  return {
    textColumn: selections.textColumn ?? detectedText,
    labelColumn,
    scoreColumn,
    scoreThreshold,
    assumeLabel:
      labelColumn === null && scoreColumn === null
        ? (selections.assumeLabel ?? suggestedAssume)
        : null,
    textColumnAutoDetected:
      selections.textColumn === null && detectedText !== null,
    labelColumnAutoDetected:
      selections.labelColumn === null && detectedLabel !== null,
    assumeLabelAutoDetected:
      labelColumn === null &&
      scoreColumn === null &&
      selections.assumeLabel === null &&
      suggestedAssume !== null,
    scoreThresholdAutoDetected:
      scoreColumn !== null && selections.scoreThreshold === null,
  };
}

function toLabelDecision(value: string | undefined): LabelDecision {
  return value === 'allow' || value === 'block' ? value : 'skip';
}

/**
 * Converts a preview's already-deduplicated label values into the same
 * `DistinctLabelValuesOutcome` shape the upload flow's mapping UI expects,
 * so `BenchmarkUploadMapping` can be reused unchanged. Default decisions come
 * from the gateway's `suggested_label_values`; a value missing from that map
 * defaults to `skip`. Returns `null` when no label column is in effect - the
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
  preview: HubDatasetPreview,
  labelColumn: string | null
): DistinctLabelValuesOutcome | null {
  if (labelColumn === null) return null;

  const defaultDecisions: Record<string, LabelDecision> = {};
  for (const value of preview.label_values) {
    defaultDecisions[value] = toLabelDecision(
      preview.suggested_label_values[value]
    );
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
  /** Sent with `scoreThreshold` only while no label column is set. */
  scoreColumn: string | null;
  scoreThreshold: number | null;
  /** Ignored while a label column or score column is set - the gateway only
   * accepts it for datasets with neither. */
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
  const {
    identity,
    textColumn,
    labelColumn,
    scoreColumn,
    scoreThreshold,
    valueDecisions,
    assumeLabel,
  } = args;
  const useScore = scoreColumn !== null && !labelColumn;

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
    ...(useScore ? { score_column: scoreColumn } : {}),
    ...(useScore && scoreThreshold !== null
      ? { score_threshold: scoreThreshold }
      : {}),
    ...(assumeLabel && !labelColumn && !useScore
      ? { assume_label: assumeLabel }
      : {}),
  };
}

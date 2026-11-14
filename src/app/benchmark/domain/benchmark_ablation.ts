import {
  type getBenchmarkRunAblationResponse,
  type BenchmarkAblationConfigurationBody as AblationConfiguration,
  type BenchmarkWilsonIntervalBody as AblationInterval,
} from '@/src/__codegen__/rest/benchmark';
import { formatDurationMs } from '@/src/framework/format/format_duration_ms';
import { formatPercent } from '@/src/framework/format/format_percent';

// The ablation wire types are generated from the gateway's per-tag swagger
// slice (schema/benchmark). Alias them to the domain vocabulary.
export type {
  BenchmarkAblationConfigurationBody as AblationConfiguration,
  BenchmarkAblationUnknownReasonBody as AblationUnknownReason,
  BenchmarkRunAblationResponse as AblationResult,
  BenchmarkWilsonIntervalBody as AblationInterval,
} from '@/src/__codegen__/rest/benchmark';

/** The server code of a 409 that means "this run was not started with ablation". */
export const RUN_NOT_ABLATION_CODE = 'run_not_ablation';

/** Shown in the latency column header's explanation (hover and keyboard). */
export const ABLATION_LATENCY_EXPLANATION =
  'Estimated from per-layer timings of one evidence run, not measured on a gateway running this configuration.';

const CONFIGURATION_LABELS: Readonly<Record<string, string>> = {
  none: 'No defense',
  rules: 'Rules',
  'rules-similarity': 'Rules + similarity',
  classifier: 'Classifier',
  'rules-classifier': 'Rules + classifier',
  'rules-similarity-classifier': 'Rules + similarity + classifier',
  'full-chain': 'Full chain',
};

/** Readable label of a configuration name; an unknown name is shown as sent. */
export const describeAblationConfiguration = (name: string): string =>
  CONFIGURATION_LABELS[name] ?? name;

/** What the card shows for one GET .../ablation answer. */
export type AblationCardState =
  | { kind: 'loading' }
  // No card at all: an unknown run (404, the rows view already says so) or a
  // run that was not started with ablation (409 run_not_ablation).
  | { kind: 'hidden' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      configurations: AblationConfiguration[];
      notes: string[];
    };

/**
 * Interprets the generated fetcher's answer. It resolves for every HTTP
 * status, so a non-200 is read here, not left to read as "no configurations".
 * `error` is the transport failure SWR reports when no response arrived.
 */
export const describeAblationState = (
  response: getBenchmarkRunAblationResponse | undefined,
  error: unknown
): AblationCardState => {
  if (response?.status === 200) {
    return {
      kind: 'ready',
      configurations: response.data.configurations ?? [],
      notes: response.data.notes ?? [],
    };
  }
  if (response?.status === 404) return { kind: 'hidden' };
  if (
    response?.status === 409 &&
    response.data.code === RUN_NOT_ABLATION_CODE
  ) {
    return { kind: 'hidden' };
  }
  if (response || error) return { kind: 'unavailable' };

  return { kind: 'loading' };
};

/** A rate cell: the value, its 95% interval, and the rows it is taken over. */
export interface AblationRateView {
  value: string;
  interval: string;
  basis: string;
}

const NOT_AVAILABLE = 'n/a';

/**
 * `hits` of `known` rows, e.g. 57 of 60 attacks. A configuration with no
 * known rows of the kind has no rate, so it reads "n/a" and no interval.
 */
export const describeAblationRate = (
  rate: number,
  interval: AblationInterval,
  hits: number,
  known: number,
  noun: 'attacks' | 'benign rows'
): AblationRateView => {
  if (known === 0) {
    return { value: NOT_AVAILABLE, interval: '', basis: `0 ${noun} known` };
  }

  return {
    value: formatPercent(rate, { digits: 1 }),
    interval: `95% CI ${formatPercent(interval.lower, { digits: 1 })} - ${formatPercent(interval.upper, { digits: 1 })}`,
    basis: `${hits} of ${known} ${noun}`,
  };
};

/** The rows of a configuration whose verdict is unknown, with the reasons. */
export interface AblationUnknownView {
  total: number;
  reasons: string[];
}

/**
 * Unknown rows are attacks plus benign rows no layer blocked while some layer
 * was not evaluated. The per-reason counts are unevaluated layers, so they
 * may add up to more than the row total.
 */
export const describeAblationUnknown = (
  configuration: AblationConfiguration
): AblationUnknownView => ({
  total: configuration.unknown_attacks + configuration.unknown_benign,
  reasons: (configuration.unknown_reasons ?? []).map(
    ({ reason, layers }) =>
      `${reason.replaceAll('_', ' ')}: ${layers} ${layers === 1 ? 'layer' : 'layers'}`
  ),
});

/**
 * An estimated latency in ms, in the console's duration format. Exactly zero
 * is a configuration with no layer to time ("No defense"), not a fast stage,
 * so it reads "0 ms" rather than "<0.1 ms".
 */
export const formatAblationLatency = (ms: number): string =>
  ms === 0 ? '0 ms' : formatDurationMs(ms);

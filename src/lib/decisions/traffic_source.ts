import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Traffic-source attribution vocabulary (PACT-484): /v1/check callers declare
// synthetic traffic via the optional `traffic_source` request field, and the
// gateway mirrors it verbatim onto the pact.decisions audit event. Real
// client-app traffic is deliberately UNDECLARED - per the contract,
// traffic_source marks synthetic-vs-real, so absence means real.
//
// Values must match the wire pattern ^[a-z0-9_-]{1,32}$ (enforced by
// pact-gateway's validateTrafficSource and the decisions schema).
//
// pact-web's Test Lab and dashboard Quick Probe both stamp `test_lab`;
// pact-benchmark stamps `benchmark` (its own TRAFFIC_SOURCE_BENCHMARK in
// runner.py, PACT-485). Keep this file in sync with any new declared source
// fleet-wide.
export const TRAFFIC_SOURCE_TEST_LAB = 'test_lab';
export const TRAFFIC_SOURCE_BENCHMARK = 'benchmark';

// Presentation buckets for grouping decisions by origin in the UI (dashboard
// source tabs, audit row badge). `client` is the undeclared-traffic bucket.
export type TrafficBucket = 'client' | 'test_lab' | 'benchmark' | 'other';

export const TRAFFIC_BUCKET_LABELS: Record<TrafficBucket, string> = {
  client: 'Client app',
  test_lab: 'Test Lab',
  benchmark: 'Benchmark',
  other: 'Other synthetic',
};

/**
 * Maps a decision's declared traffic_source onto its presentation bucket.
 *
 * Undeclared (absent or empty) means real client traffic. A declared value
 * outside the known vocabulary buckets as 'other' rather than being folded
 * into a known source - it is synthetic by declaration, but claiming it came
 * from the Test Lab (or worse, from real clients) would misattribute it.
 * No case normalization: the wire pattern is lowercase-only.
 */
export const decisionTrafficBucket = (dp: DecisionPayload): TrafficBucket => {
  const source = dp.traffic_source;
  if (!source) return 'client';
  if (source === TRAFFIC_SOURCE_TEST_LAB) return 'test_lab';
  if (source === TRAFFIC_SOURCE_BENCHMARK) return 'benchmark';

  return 'other';
};

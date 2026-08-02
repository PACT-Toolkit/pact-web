import { describe, expect, it } from 'vitest';

import {
  TRAFFIC_BUCKET_LABELS,
  TRAFFIC_SOURCE_BENCHMARK,
  TRAFFIC_SOURCE_TEST_LAB,
  decisionTrafficBucket,
} from './traffic_source';

describe('decisionTrafficBucket', () => {
  it('buckets an undeclared traffic_source as client traffic', () => {
    // Absence means real traffic per the PACT-484 contract - traffic_source
    // declares synthetic-vs-real, so real client apps send nothing.
    expect(decisionTrafficBucket({ decision: 'allow' })).toBe('client');
  });

  it('buckets an empty-string traffic_source as client traffic', () => {
    expect(decisionTrafficBucket({ traffic_source: '' })).toBe('client');
  });

  it('buckets test_lab onto its own bucket', () => {
    expect(decisionTrafficBucket({ traffic_source: 'test_lab' })).toBe(
      'test_lab'
    );
  });

  it('buckets benchmark onto its own bucket', () => {
    expect(decisionTrafficBucket({ traffic_source: 'benchmark' })).toBe(
      'benchmark'
    );
  });

  it('buckets an unknown declared source as other, never as a known source', () => {
    // A declared source is synthetic by contract; folding it into client
    // (real traffic) or test_lab (a specific tool) would misattribute it.
    expect(decisionTrafficBucket({ traffic_source: 'load_test' })).toBe(
      'other'
    );
  });

  it('does not case-fold: the wire pattern is lowercase-only', () => {
    // ^[a-z0-9_-]{1,32}$ can never produce 'TEST_LAB' on a real event, so an
    // uppercase value is an unknown (hand-crafted) source, not Test Lab.
    expect(decisionTrafficBucket({ traffic_source: 'TEST_LAB' })).toBe('other');
  });

  it('keeps the exported source constants in the vocabulary it maps', () => {
    expect(
      decisionTrafficBucket({ traffic_source: TRAFFIC_SOURCE_TEST_LAB })
    ).toBe('test_lab');
    expect(
      decisionTrafficBucket({ traffic_source: TRAFFIC_SOURCE_BENCHMARK })
    ).toBe('benchmark');
  });
});

describe('TRAFFIC_BUCKET_LABELS', () => {
  it('labels every bucket decisionTrafficBucket can return', () => {
    for (const source of [undefined, 'test_lab', 'benchmark', 'load_test']) {
      const bucket = decisionTrafficBucket({ traffic_source: source });
      expect(TRAFFIC_BUCKET_LABELS[bucket]).toBeTruthy();
    }
  });
});

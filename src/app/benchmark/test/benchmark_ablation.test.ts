import { describe, expect, it } from 'vitest';

import {
  ABLATION_LATENCY_EXPLANATION,
  describeAblationConfiguration,
  describeAblationRate,
  describeAblationState,
  describeAblationUnknown,
  formatAblationLatency,
} from '@/src/app/benchmark/domain/benchmark_ablation';
import { MOCK_ABLATION_CONFIGURATIONS } from '@/src/app/benchmark/mock/data/benchmark_ablation';

const response = (status: number, data: unknown) =>
  ({ status, data, headers: new Headers() }) as never;

const classifier = MOCK_ABLATION_CONFIGURATIONS.find(
  (c) => c.name === 'classifier'
)!;

describe('describeAblationConfiguration', () => {
  it.each([
    ['none', 'No defense'],
    ['rules', 'Rules'],
    ['rules-similarity', 'Rules + similarity'],
    ['classifier', 'Classifier'],
    ['rules-classifier', 'Rules + classifier'],
    ['rules-similarity-classifier', 'Rules + similarity + classifier'],
    ['full-chain', 'Full chain'],
  ])('labels %s as %s', (name, label) => {
    expect(describeAblationConfiguration(name)).toBe(label);
  });

  it('falls back to the raw name for a configuration it does not know', () => {
    expect(describeAblationConfiguration('rules-sandbox')).toBe(
      'rules-sandbox'
    );
  });
});

describe('describeAblationRate', () => {
  it('shows the rate, its interval and the rows it is taken over', () => {
    expect(
      describeAblationRate(
        0.95,
        { lower: 0.8627, upper: 0.9833 },
        57,
        60,
        'attacks'
      )
    ).toEqual({
      value: '95.0%',
      interval: '95% CI 86.3% - 98.3%',
      basis: '57 of 60 attacks',
    });
  });

  it('shows a zero rate as 0.0% with its interval', () => {
    const view = describeAblationRate(
      0,
      { lower: 0, upper: 0.0602 },
      0,
      60,
      'benign rows'
    );

    expect(view.value).toBe('0.0%');
    expect(view.interval).toBe('95% CI 0.0% - 6.0%');
    expect(view.basis).toBe('0 of 60 benign rows');
  });

  it('shows n/a with no interval when no row of the kind is known', () => {
    expect(
      describeAblationRate(0, { lower: 0, upper: 0 }, 0, 0, 'attacks')
    ).toEqual({ value: 'n/a', interval: '', basis: '0 attacks known' });
  });
});

describe('describeAblationUnknown', () => {
  it('sums unknown attacks and benign rows and lists each reason', () => {
    expect(describeAblationUnknown(classifier)).toEqual({
      total: 5,
      reasons: ['timeout: 3 layers', 'throttled: 3 layers'],
    });
  });

  it('reads a single layer in the singular and replaces underscores', () => {
    expect(
      describeAblationUnknown({
        ...classifier,
        unknown_reasons: [{ reason: 'not_loaded', layers: 1 }],
      }).reasons
    ).toEqual(['not loaded: 1 layer']);
  });

  it('has no reasons for a configuration with no unknown rows', () => {
    expect(
      describeAblationUnknown({
        ...classifier,
        unknown_attacks: 0,
        unknown_benign: 0,
        unknown_reasons: [],
      })
    ).toEqual({ total: 0, reasons: [] });
  });
});

describe('formatAblationLatency', () => {
  it('uses the console duration format', () => {
    expect(formatAblationLatency(2.1)).toBe('2.1 ms');
    expect(formatAblationLatency(432.9)).toBe('433 ms');
  });

  it('reads a configuration with nothing to time as 0 ms', () => {
    expect(formatAblationLatency(0)).toBe('0 ms');
  });
});

describe('describeAblationState', () => {
  it('is loading with neither a response nor an error', () => {
    expect(describeAblationState(undefined, undefined)).toEqual({
      kind: 'loading',
    });
  });

  it('is ready with the configurations and notes of a 200', () => {
    const state = describeAblationState(
      response(200, {
        run_id: 'r',
        configurations: [classifier],
        notes: ['a note'],
      }),
      undefined
    );

    expect(state).toEqual({
      kind: 'ready',
      configurations: [classifier],
      notes: ['a note'],
    });
  });

  it('tolerates a 200 body with no notes', () => {
    expect(
      describeAblationState(
        response(200, { run_id: 'r', configurations: [] }),
        undefined
      )
    ).toEqual({ kind: 'ready', configurations: [], notes: [] });
  });

  it('hides the card for an unknown run (404)', () => {
    expect(
      describeAblationState(response(404, { code: 'not_found' }), undefined)
    ).toEqual({ kind: 'hidden' });
  });

  it('hides the card for a run that was not started with ablation (409)', () => {
    expect(
      describeAblationState(
        response(409, { code: 'run_not_ablation' }),
        undefined
      )
    ).toEqual({ kind: 'hidden' });
  });

  it.each([
    [409, { code: 'something_else' }],
    [502, { code: 'unavailable' }],
    [503, { code: 'unavailable' }],
    [401, 'unauthorized'],
  ])(
    'is unavailable for a %s that is not "not an ablation run"',
    (status, data) => {
      expect(describeAblationState(response(status, data), undefined)).toEqual({
        kind: 'unavailable',
      });
    }
  );

  it('is unavailable when the request itself failed', () => {
    expect(describeAblationState(undefined, new Error('network'))).toEqual({
      kind: 'unavailable',
    });
  });
});

describe('ABLATION_LATENCY_EXPLANATION', () => {
  it('says the latencies are estimates', () => {
    expect(ABLATION_LATENCY_EXPLANATION).toContain('Estimated');
    expect(ABLATION_LATENCY_EXPLANATION).toContain('not measured');
  });
});

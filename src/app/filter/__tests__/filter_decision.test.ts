import { describe, expect, it } from 'vitest';

import {
  parsePayload,
  withFalsePositiveFlag,
} from '@/src/app/filter/domain/filter_decision';

describe('withFalsePositiveFlag', () => {
  it('stamps is_false_positive: true onto a valid payload', () => {
    const raw = JSON.stringify({
      request_id: 'req-1',
      decision: 'block',
      filter_rule_id: 'inject-003',
      latency_ms: 4,
    });

    const updated = withFalsePositiveFlag(raw);
    const parsed = parsePayload(updated);

    expect(parsed?.is_false_positive).toBe(true);
    expect(parsed?.request_id).toBe('req-1');
    expect(parsed?.filter_rule_id).toBe('inject-003');
  });

  it('leaves the raw string unchanged when it is not valid JSON', () => {
    const raw = 'not json';

    expect(withFalsePositiveFlag(raw)).toBe(raw);
  });
});

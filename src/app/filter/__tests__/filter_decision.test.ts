import { describe, expect, it } from 'vitest';

import { parsePayload } from '@/src/app/filter/domain/filter_decision';

describe('parsePayload', () => {
  it('parses a valid pact.decisions payload', () => {
    const raw = JSON.stringify({
      request_id: 'req-1',
      decision: 'block',
      filter_rule_id: 'inject-003',
      latency_ms: 4,
    });

    const parsed = parsePayload(raw);

    expect(parsed?.request_id).toBe('req-1');
    expect(parsed?.decision).toBe('block');
    expect(parsed?.filter_rule_id).toBe('inject-003');
    expect(parsed?.latency_ms).toBe(4);
  });

  it('returns null for a string that is not valid JSON', () => {
    expect(parsePayload('not json')).toBeNull();
  });
});

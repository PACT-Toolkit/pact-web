import { describe, expect, it } from 'vitest';

import { checkResponseFromSaturation } from '@/src/framework/decisions/classifier_saturation';

describe('checkResponseFromSaturation - the gateway 429 lifted into a block', () => {
  it('turns a classifier_saturated 429 into a classifier block decision', () => {
    expect(
      checkResponseFromSaturation(
        {
          status: 429,
          data: { code: 'classifier_saturated', error: 'at capacity' },
        },
        42
      )
    ).toEqual({
      request_id: '',
      decision: 'block',
      reason: 'classifier_saturated',
      latency_ms: 42,
    });
  });

  it.each([
    { name: 'a 429 with another code', status: 429, data: { code: 'other' } },
    { name: 'a 429 with a plain string body', status: 429, data: 'slow down' },
    {
      name: 'a non-429 carrying the code',
      status: 503,
      data: { code: 'classifier_saturated' },
    },
  ])('ignores $name', ({ status, data }) => {
    expect(checkResponseFromSaturation({ status, data }, 1)).toBeUndefined();
  });
});

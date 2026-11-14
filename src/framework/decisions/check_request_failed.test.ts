import { describe, expect, it } from 'vitest';

import { checkRequestFailed } from '@/src/framework/decisions/check_request_failed';
import { describeInputTooLarge } from '@/src/framework/decisions/input_too_large';

describe('checkRequestFailed', () => {
  it('is false before any request and for a 200', () => {
    expect(checkRequestFailed(undefined, undefined)).toBe(false);
    expect(checkRequestFailed(undefined, { status: 200 })).toBe(false);
  });

  it('is true when the hook threw, even with no response', () => {
    expect(checkRequestFailed(new Error('network'), undefined)).toBe(true);
  });

  it('is true for any non-200 answer', () => {
    for (const status of [400, 401, 413, 429, 503, 504]) {
      expect(checkRequestFailed(undefined, { status })).toBe(true);
    }
  });

  it('is false for a 413 once it is described as an input-too-large answer', () => {
    const response = {
      status: 413,
      data: { code: 'input_too_large', max_input_bytes: 10 },
    };
    const tooLarge = describeInputTooLarge(response, 'a'.repeat(20));

    expect(checkRequestFailed(undefined, response, tooLarge)).toBe(false);
    expect(checkRequestFailed(undefined, response)).toBe(true);
  });
});

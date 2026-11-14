import { describe, expect, it } from 'vitest';

import { describeInputTooLarge } from '@/src/framework/decisions/input_too_large';

const tooLarge = (maxInputBytes?: unknown) => ({
  status: 413,
  data: {
    code: 'input_too_large',
    error: 'too large',
    max_input_bytes: maxInputBytes,
  },
});

describe('describeInputTooLarge - the gateway 413 as a size message', () => {
  it('words the submitted size and the limit from max_input_bytes', () => {
    const result = describeInputTooLarge(tooLarge(40_573), 'a'.repeat(52_310));

    expect(result?.message).toBe(
      'Input too large: 52,310 bytes, limit 40,573 bytes'
    );
    expect(result?.inputBytes).toBe(52_310);
    expect(result?.maxInputBytes).toBe(40_573);
  });

  it('measures UTF-8 bytes, not characters', () => {
    // Three-byte characters: 10 chars are 30 bytes.
    expect(describeInputTooLarge(tooLarge(5), '€'.repeat(10))?.inputBytes).toBe(
      30
    );
  });

  it('drops the limit clause when the body carries no usable limit', () => {
    for (const limit of [undefined, 0, -1, Number.NaN, '40573']) {
      expect(describeInputTooLarge(tooLarge(limit), 'abc')?.message).toBe(
        'Input too large: 3 bytes'
      );
    }
    expect(
      describeInputTooLarge({ status: 413, data: 'proxy text' }, 'abc')?.message
    ).toBe('Input too large: 3 bytes');
    expect(describeInputTooLarge({ status: 413, data: null }, 'abc')).toEqual({
      inputBytes: 3,
      maxInputBytes: undefined,
      message: 'Input too large: 3 bytes',
    });
  });

  it('returns undefined for every other status', () => {
    for (const status of [200, 400, 429, 503]) {
      expect(
        describeInputTooLarge({ status, data: tooLarge(1).data }, 'abc')
      ).toBeUndefined();
    }
  });
});

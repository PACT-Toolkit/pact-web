import { describe, expect, it, vi } from 'vitest';

import { parseSplashEnabled } from '@/src/framework/motion/splash_enabled';

vi.mock('server-only', () => ({}));

describe('parseSplashEnabled', () => {
  it.each([
    ['unset', undefined, false],
    ['empty', '', false],
    ['enabled', 'enabled', true],
    ['enabled with padding and case', '  Enabled ', true],
    ['true', 'true', false],
    ['1', '1', false],
    ['disabled', 'disabled', false],
    ['enable', 'enable', false],
  ])('%s', (_label, raw, expected) => {
    expect(parseSplashEnabled(raw)).toBe(expected);
  });
});

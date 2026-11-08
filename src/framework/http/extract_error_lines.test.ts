import { describe, expect, it } from 'vitest';

import {
  describeHttpFailureLines,
  extractServerErrorLines,
} from '@/src/framework/http/extract_error_message';

const PROXY_502_PAGE =
  '<!DOCTYPE html>\n<html>\n<head><title>502: Bad gateway</title></head>\n</html>';

describe('extractServerErrorLines', () => {
  it('keeps a multi-line plain message as separate trimmed lines', () => {
    expect(extractServerErrorLines({ error: 'one\r\n\ntwo\n  three  ' })).toBe(
      'one\ntwo\nthree'
    );
  });

  it('accepts a short single-line string', () => {
    expect(extractServerErrorLines('missing required permission')).toBe(
      'missing required permission'
    );
  });

  it('rejects markup on any line', () => {
    expect(extractServerErrorLines(PROXY_502_PAGE)).toBeUndefined();
    expect(extractServerErrorLines('fine\n<b>x</b>')).toBeUndefined();
  });

  it('rejects a message when any line exceeds the line limit', () => {
    expect(
      extractServerErrorLines(`short\n${'x'.repeat(201)}`)
    ).toBeUndefined();
  });

  it('caps at 10 lines and adds an and-N-more line', () => {
    const text = Array.from({ length: 13 }, (_, index) => `l${index}`).join(
      '\n'
    );
    const lines = (extractServerErrorLines(text) ?? '').split('\n');

    expect(lines).toHaveLength(11);
    expect(lines[9]).toBe('l9');
    expect(lines[10]).toBe('and 3 more');
  });

  it('falls back to the code when the error is unusable', () => {
    expect(
      extractServerErrorLines({ code: 'unavailable', error: '<b>x</b>' })
    ).toBe('unavailable');
  });

  it('is undefined for a missing or blank body', () => {
    expect(extractServerErrorLines(undefined)).toBeUndefined();
    expect(extractServerErrorLines('  \n ')).toBeUndefined();
  });
});

describe('describeHttpFailureLines', () => {
  it('shows the multi-line server message', () => {
    expect(describeHttpFailureLines(400, { error: 'a\nb' })).toBe('a\nb');
  });

  it('names the status when nothing is displayable', () => {
    expect(describeHttpFailureLines(500, undefined)).toBe(
      'The gateway returned an error (HTTP 500).'
    );
  });
});

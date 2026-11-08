import { describe, expect, it } from 'vitest';

import {
  describeHttpFailure,
  describeHttpFailureLines,
  extractServerErrorLines,
  extractServerErrorMessage,
} from '@/src/framework/http/extract_error_message';

const PROXY_502_PAGE =
  '<!DOCTYPE html>\n<html>\n<head><title>502: Bad gateway</title></head>\n<body><h1>502: Bad gateway</h1></body>\n</html>';

describe('extractServerErrorMessage', () => {
  it.each([
    ['undefined body', undefined],
    ['empty string', ''],
    ['whitespace only', '   \n '],
    ['html document', PROXY_502_PAGE],
    ['html document on one line', PROXY_502_PAGE.replaceAll('\n', '')],
    ['html fragment', '<h1>Bad gateway</h1>'],
    ['closing tag only', 'oops </div>'],
    ['long single-line text', 'x'.repeat(201)],
    ['multi-line text', 'first line\nsecond line'],
    ['structured error with markup', { error: '<html>502</html>' }],
    ['structured code with markup', { code: '<!DOCTYPE html>' }],
    ['structured error that is too long', { error: 'y'.repeat(201) }],
  ])('returns undefined for %s', (_name, body) => {
    expect(extractServerErrorMessage(body)).toBeUndefined();
  });

  it('keeps short single-line plain text, trimmed', () => {
    expect(extractServerErrorMessage('missing required permission\n')).toBe(
      'missing required permission'
    );
  });

  it('keeps text with a bare less-than sign that is not a tag', () => {
    expect(extractServerErrorMessage('score < 5 is not allowed')).toBe(
      'score < 5 is not allowed'
    );
  });

  it('prefers the structured error over the code', () => {
    expect(
      extractServerErrorMessage({ code: 'unavailable', error: 'try later' })
    ).toBe('try later');
  });

  it('falls back to the structured code when the error is unusable', () => {
    expect(
      extractServerErrorMessage({ code: 'unavailable', error: '<b>x</b>' })
    ).toBe('unavailable');
  });
});

describe('describeHttpFailure', () => {
  it('shows the displayable server message', () => {
    expect(describeHttpFailure(403, 'missing required permission')).toBe(
      'missing required permission'
    );
  });

  it('names the status when the body was markup', () => {
    expect(describeHttpFailure(502, PROXY_502_PAGE)).toBe(
      'The gateway returned an error (HTTP 502).'
    );
  });

  it('names the status when there is no body', () => {
    expect(describeHttpFailure(500, undefined)).toBe(
      'The gateway returned an error (HTTP 500).'
    );
  });
});

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

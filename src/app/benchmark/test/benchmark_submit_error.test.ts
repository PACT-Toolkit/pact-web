import { describe, expect, it } from 'vitest';

import { describeBenchmarkSubmitError } from '@/src/app/benchmark/domain/benchmark_submit_error';

const lineErrors = (count: number): string =>
  Array.from(
    { length: count },
    (_, index) =>
      `line ${index + 1}: row 'r${index}' content exceeds 65536 bytes`
  ).join('\n');

describe('describeBenchmarkSubmitError', () => {
  it('shows the server validation report line by line', () => {
    const message = describeBenchmarkSubmitError(400, {
      code: 'invalid_argument',
      error: `2 validation error(s) in corpus:\n${lineErrors(2)}`,
    });

    expect(message.split('\n')).toEqual([
      '2 validation error(s) in corpus:',
      "line 1: row 'r0' content exceeds 65536 bytes",
      "line 2: row 'r1' content exceeds 65536 bytes",
    ]);
  });

  it('cuts a long report at 10 lines and counts the rest', () => {
    const message = describeBenchmarkSubmitError(400, {
      error: lineErrors(15),
    });
    const lines = message.split('\n');

    expect(lines).toHaveLength(11);
    expect(lines[9]).toBe("line 10: row 'r9' content exceeds 65536 bytes");
    expect(lines[10]).toBe('and 5 more');
  });

  it('does not add a more-line at exactly 10 lines', () => {
    const message = describeBenchmarkSubmitError(400, {
      error: lineErrors(10),
    });

    expect(message.split('\n')).toHaveLength(10);
    expect(message).not.toContain('more');
  });

  it('names the status when a line is too long to be a message', () => {
    expect(describeBenchmarkSubmitError(400, { error: 'x'.repeat(201) })).toBe(
      'The gateway returned an error (HTTP 400).'
    );
  });

  it('names the status when the body is a markup page', () => {
    expect(
      describeBenchmarkSubmitError(
        502,
        '<html>\n<body>Bad gateway</body>\n</html>'
      )
    ).toBe('The gateway returned an error (HTTP 502).');
  });

  it('names the status when there is no body', () => {
    expect(describeBenchmarkSubmitError(500, undefined)).toBe(
      'The gateway returned an error (HTTP 500).'
    );
  });
});

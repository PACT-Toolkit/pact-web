import { describe, expect, it } from 'vitest';

import { truncateWithEllipsis } from '@/src/framework/format/truncate_text';

describe('truncateWithEllipsis', () => {
  it('returns text that fits unchanged', () => {
    expect(truncateWithEllipsis('prompt-hacking', 28)).toBe('prompt-hacking');
  });

  it('returns text exactly at the limit unchanged', () => {
    expect(truncateWithEllipsis('abcde', 5)).toBe('abcde');
  });

  it('cuts the tail and keeps the total within the limit', () => {
    const result = truncateWithEllipsis(
      'paraphrase-credential-exfiltration',
      28
    );

    expect(result).toBe('paraphrase-credential-exfil…');
    expect(result).toHaveLength(28);
  });

  it('degrades to the bare ellipsis or nothing for a tiny limit', () => {
    expect(truncateWithEllipsis('abcdef', 1)).toBe('…');
    expect(truncateWithEllipsis('abcdef', 0)).toBe('');
  });
});

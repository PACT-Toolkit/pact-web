import { describe, expect, it } from 'vitest';

import { parseCorpusFile } from '@/src/app/benchmark/domain/benchmark_corpus_parse';

describe('parseCorpusFile', () => {
  it('rejects an unsupported file extension', () => {
    const result = parseCorpusFile('corpus.txt', 'content');
    expect(result).toEqual({
      ok: false,
      error: 'File must be .jsonl, .ndjson, .json, or .csv',
    });
  });

  it('rejects an empty file', () => {
    const result = parseCorpusFile('corpus.jsonl', '   \n  ');
    expect(result).toEqual({ ok: false, error: 'File is empty' });
  });

  describe('JSONL', () => {
    it('parses rows and collects the column union across rows', () => {
      const text = [
        '{"content": "hello", "expected_label": "allow"}',
        '{"content": "world", "expected_label": "block", "category": "attack"}',
      ].join('\n');

      const result = parseCorpusFile('corpus.jsonl', text);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.columns).toEqual([
        'content',
        'expected_label',
        'category',
      ]);
      expect(result.corpus.rows).toEqual([
        { content: 'hello', expected_label: 'allow' },
        { content: 'world', expected_label: 'block', category: 'attack' },
      ]);
    });

    it('reports the offending row on malformed JSON', () => {
      const text = ['{"content": "hello"}', 'not json'].join('\n');
      const result = parseCorpusFile('corpus.jsonl', text);
      expect(result).toEqual({ ok: false, error: 'Row 2 is not valid JSON' });
    });

    it('rejects a row that is not a JSON object', () => {
      const result = parseCorpusFile('corpus.jsonl', '[1, 2, 3]');
      expect(result).toEqual({
        ok: false,
        error: 'Row 1 is not a JSON object',
      });
    });

    it('tolerates CRLF line endings', () => {
      const text = '{"content": "a"}\r\n{"content": "b"}\r\n';
      const result = parseCorpusFile('corpus.jsonl', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toHaveLength(2);
    });
  });

  describe('NDJSON', () => {
    it('parses the same as .jsonl', () => {
      const text = '{"text": "hello"}\n{"text": "world"}';
      const result = parseCorpusFile('corpus.ndjson', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toHaveLength(2);
    });
  });

  describe('JSON array', () => {
    it('parses an array of objects', () => {
      const text = JSON.stringify([
        { content: 'hello', label: 'allow' },
        { content: 'world', label: 'block' },
      ]);
      const result = parseCorpusFile('corpus.json', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.columns).toEqual(['content', 'label']);
      expect(result.corpus.rows).toHaveLength(2);
    });

    it('rejects a JSON file that is not an array', () => {
      const result = parseCorpusFile('corpus.json', '{"content": "hello"}');
      expect(result).toEqual({
        ok: false,
        error: 'JSON file must contain an array of objects',
      });
    });

    it('rejects malformed JSON', () => {
      const result = parseCorpusFile('corpus.json', 'not json');
      expect(result).toEqual({ ok: false, error: 'File is not valid JSON' });
    });

    it('rejects an empty array', () => {
      const result = parseCorpusFile('corpus.json', '[]');
      expect(result).toEqual({ ok: false, error: 'File is empty' });
    });

    it('rejects a non-object array entry', () => {
      const result = parseCorpusFile(
        'corpus.json',
        '[{"content":"a"}, "oops"]'
      );
      expect(result).toEqual({
        ok: false,
        error: 'Row 2 is not a JSON object',
      });
    });
  });

  describe('CSV', () => {
    it('parses a simple CSV into columns and rows', () => {
      const text = ['text,label', 'hello,allow', 'world,block'].join('\n');
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.columns).toEqual(['text', 'label']);
      expect(result.corpus.rows).toEqual([
        { text: 'hello', label: 'allow' },
        { text: 'world', label: 'block' },
      ]);
    });

    it('handles a quoted field containing a comma', () => {
      const text = ['content,label', '"hello, world",allow'].join('\n');
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toEqual([
        { content: 'hello, world', label: 'allow' },
      ]);
    });

    it('handles doubled-quote escaping inside a quoted field', () => {
      const text = ['content,label', '"she said ""hi""",allow'].join('\n');
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toEqual([
        { content: 'she said "hi"', label: 'allow' },
      ]);
    });

    it('handles an embedded newline inside a quoted field', () => {
      const text = ['content,label', '"line one\nline two",allow'].join('\n');
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toEqual([
        { content: 'line one\nline two', label: 'allow' },
      ]);
    });

    it('handles CRLF line endings', () => {
      const text = 'content,label\r\nhello,allow\r\nworld,block\r\n';
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.rows).toEqual([
        { content: 'hello', label: 'allow' },
        { content: 'world', label: 'block' },
      ]);
    });

    it('rejects a CSV with only a header row', () => {
      const result = parseCorpusFile('corpus.csv', 'content,label');
      expect(result).toEqual({ ok: false, error: 'File is empty' });
    });

    it('trims header whitespace', () => {
      const text = [' content , label ', 'hello,allow'].join('\n');
      const result = parseCorpusFile('corpus.csv', text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.corpus.columns).toEqual(['content', 'label']);
    });
  });
});

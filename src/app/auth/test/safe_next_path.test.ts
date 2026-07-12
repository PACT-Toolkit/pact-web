import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../domain/safe_next_path';

describe('safeNextPath', () => {
  it('falls back to /dashboard for missing input', () => {
    expect(safeNextPath(undefined)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
  });

  it('accepts a same-origin absolute path', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/projects/42?tab=overview')).toBe(
      '/projects/42?tab=overview'
    );
  });

  it('rejects protocol-relative URLs (open-redirect bait)', () => {
    expect(safeNextPath('//evil.example/path')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.example/path')).toBe('/dashboard');
  });

  it('rejects absolute URLs', () => {
    expect(safeNextPath('https://evil.example/dashboard')).toBe('/dashboard');
    expect(safeNextPath('http://localhost:1234/foo')).toBe('/dashboard');
  });

  it('rejects relative paths without a leading slash', () => {
    expect(safeNextPath('dashboard')).toBe('/dashboard');
    expect(safeNextPath('../admin')).toBe('/dashboard');
  });

  it('uses the first value when given an array (Next searchParams shape)', () => {
    expect(safeNextPath(['/projects', '/admin'])).toBe('/projects');
    expect(safeNextPath(['//evil.example'])).toBe('/dashboard');
  });
});

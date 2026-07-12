import { describe, expect, it } from 'vitest';

import {
  buildIssueTokenRequest,
  formatExpiry,
  isIssueTokenInputValid,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '@/src/app/policy/domain/policy_token';

describe('buildIssueTokenRequest', () => {
  it('trims identifiers and passes scopes/ttl through', () => {
    expect(
      buildIssueTokenRequest({
        agentId: '  agent-alpha  ',
        toolId: '  tool-search  ',
        scopes: ['read', 'write'],
        ttlSeconds: 3600,
      })
    ).toEqual({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: ['read', 'write'],
      ttlSeconds: 3600,
    });
  });

  it('sends scopes as undefined rather than an empty array', () => {
    const req = buildIssueTokenRequest({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: [],
      ttlSeconds: 60,
    });
    expect(req.scopes).toBeUndefined();
  });
});

describe('isIssueTokenInputValid', () => {
  const valid = {
    agentId: 'agent-alpha',
    toolId: 'tool-search',
    scopes: ['read'],
    ttlSeconds: 3600,
  };

  it('accepts a fully populated, in-range input', () => {
    expect(isIssueTokenInputValid(valid)).toBe(true);
  });

  it('rejects a blank agentId or toolId', () => {
    expect(isIssueTokenInputValid({ ...valid, agentId: '  ' })).toBe(false);
    expect(isIssueTokenInputValid({ ...valid, toolId: '' })).toBe(false);
  });

  it('rejects an empty scopes list', () => {
    expect(isIssueTokenInputValid({ ...valid, scopes: [] })).toBe(false);
  });

  it('rejects ttlSeconds outside the documented 1..86400 bound', () => {
    expect(
      isIssueTokenInputValid({ ...valid, ttlSeconds: MIN_TTL_SECONDS - 1 })
    ).toBe(false);
    expect(
      isIssueTokenInputValid({ ...valid, ttlSeconds: MAX_TTL_SECONDS + 1 })
    ).toBe(false);
    expect(
      isIssueTokenInputValid({ ...valid, ttlSeconds: MIN_TTL_SECONDS })
    ).toBe(true);
    expect(
      isIssueTokenInputValid({ ...valid, ttlSeconds: MAX_TTL_SECONDS })
    ).toBe(true);
  });

  it('rejects a non-integer ttlSeconds', () => {
    expect(isIssueTokenInputValid({ ...valid, ttlSeconds: 60.5 })).toBe(false);
  });
});

describe('formatExpiry', () => {
  it('renders a unix-seconds timestamp as a locale string', () => {
    const formatted = formatExpiry(1_800_000_000);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('falls back to the raw value for a non-finite input', () => {
    expect(formatExpiry(Number.NaN)).toBe('NaN');
  });
});

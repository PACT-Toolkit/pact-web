import { describe, expect, it } from 'vitest';

import {
  buildSandboxProbeRequest,
  SANDBOX_PROBE_REFS,
  verdictBadgeClass,
} from '@/src/app/gateway/domain/gateway_sandbox';

describe('buildSandboxProbeRequest', () => {
  it('sends the canned external_refs alongside benign content', () => {
    const request = buildSandboxProbeRequest();

    expect(request.kind).toBe('input');
    expect(request.external_refs).toEqual(SANDBOX_PROBE_REFS);
    expect(request.content.length).toBeGreaterThan(0);
  });

  it('includes at least one hostile-looking reference', () => {
    expect(
      SANDBOX_PROBE_REFS?.some((ref) => ref.url?.includes('malicious'))
    ).toBe(true);
  });
});

describe('verdictBadgeClass', () => {
  it('flags hostile as destructive', () => {
    expect(verdictBadgeClass('hostile')).toContain('destructive');
  });

  it('flags mitigated as amber', () => {
    expect(verdictBadgeClass('mitigated')).toContain('amber');
  });

  it('flags unfetchable as muted', () => {
    expect(verdictBadgeClass('unfetchable')).toContain('muted');
  });

  it('defaults clean/unknown to green', () => {
    expect(verdictBadgeClass('clean')).toContain('green');
    expect(verdictBadgeClass(undefined)).toContain('green');
  });
});

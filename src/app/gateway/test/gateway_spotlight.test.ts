import { describe, expect, it } from 'vitest';

import {
  buildSpotlightProbeRequest,
  SPOTLIGHT_PROBE_CHUNKS,
  trustBadgeClass,
} from '@/src/app/gateway/domain/gateway_spotlight';

describe('buildSpotlightProbeRequest', () => {
  it('sends the canned spotlight_chunks alongside benign content', () => {
    const request = buildSpotlightProbeRequest();

    expect(request.kind).toBe('input');
    expect(request.spotlight_chunks).toEqual(SPOTLIGHT_PROBE_CHUNKS);
  });

  it('includes both a trusted and an untrusted chunk', () => {
    const trusts = SPOTLIGHT_PROBE_CHUNKS?.map((c) => c.trust);
    expect(trusts).toContain('trusted');
    expect(trusts).toContain('untrusted');
  });
});

describe('trustBadgeClass', () => {
  it('flags untrusted as destructive', () => {
    expect(trustBadgeClass('untrusted')).toContain('destructive');
  });

  it('flags user as amber', () => {
    expect(trustBadgeClass('user')).toContain('amber');
  });

  it('defaults trusted/unknown to green', () => {
    expect(trustBadgeClass('trusted')).toContain('green');
    expect(trustBadgeClass(undefined)).toContain('green');
  });
});

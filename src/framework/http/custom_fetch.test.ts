import { afterEach, describe, expect, it, vi } from 'vitest';

import { customFetch } from '@/src/__codegen__/rest/custom_fetch';

const respond = (body: string, init: ResponseInit) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, init)));

const call = () =>
  customFetch<{ data: unknown; status: number }>('/x', { method: 'GET' });

describe('customFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops a text/html error page but keeps the status', async () => {
    respond('<html><body>502: Bad gateway</body></html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    });

    expect(await call()).toMatchObject({ data: undefined, status: 502 });
  });

  it('drops a markup error body even when the content type lies', async () => {
    respond('<!DOCTYPE html><html></html>', {
      status: 502,
      headers: { 'content-type': 'text/plain' },
    });

    expect((await call()).data).toBeUndefined();
  });

  it('keeps a text/plain error body', async () => {
    respond('missing required permission', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    });

    expect(await call()).toMatchObject({
      data: 'missing required permission',
      status: 403,
    });
  });

  it('keeps a JSON error body', async () => {
    respond(JSON.stringify({ code: 'unavailable', error: 'try later' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });

    expect((await call()).data).toEqual({
      code: 'unavailable',
      error: 'try later',
    });
  });

  it('leaves a 2xx body alone', async () => {
    respond('{"ok":true}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    expect((await call()).data).toEqual({ ok: true });
  });
});

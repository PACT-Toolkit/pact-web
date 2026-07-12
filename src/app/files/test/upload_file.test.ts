import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { uploadFile } from '@/src/app/files/domain/upload_file';

// The presigned PUT target (mock-object-storage.local) is not registered in
// the app's global MSW handlers (src/app/files/mock/handlers/files.ts) --
// that gap is a tracked follow-up for the full click-through E2E flow. Unit
// tests exercising the protocol helper directly register their own scoped
// PUT handler via server.use(), reset after each test by the global vitest
// setup (vitest.setup.ts's afterEach).
const okPut = () =>
  http.put('https://mock-object-storage.local/upload/*', () =>
    HttpResponse.text('', { status: 200 })
  );

const makeFile = (name = 'report.pdf') =>
  new File(['hello world'], name, { type: 'application/pdf' });

describe('uploadFile - PACT-580 presign -> PUT -> confirm protocol helper', () => {
  it('returns ok with the confirmed fileId on the full happy path', async () => {
    server.use(okPut());

    const result = await uploadFile(makeFile());

    expect(result).toEqual({ ok: true, fileId: expect.any(String) });
  });

  it('fails at the presign step and reports its status', async () => {
    server.use(
      http.post('*/v1/files/', () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
      )
    );

    const result = await uploadFile(makeFile());

    expect(result).toEqual({
      ok: false,
      failure: { step: 'presign', status: 401 },
    });
  });

  it('fails at the PUT step and reports its status', async () => {
    server.use(
      http.put('https://mock-object-storage.local/upload/*', () =>
        HttpResponse.text('', { status: 500 })
      )
    );

    const result = await uploadFile(makeFile());

    expect(result).toEqual({
      ok: false,
      failure: { step: 'put', status: 500 },
    });
  });

  it('fails at the confirm step and reports its status', async () => {
    server.use(
      okPut(),
      http.post('*/v1/files/:id/confirm', () =>
        HttpResponse.json({ error: 'file not found' }, { status: 404 })
      )
    );

    const result = await uploadFile(makeFile());

    expect(result).toEqual({
      ok: false,
      failure: { step: 'confirm', status: 404 },
    });
  });
});

import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { uploadFile } from '@/src/app/files/domain/upload_file';

// The presigned PUT target (mock-object-storage.local) is answered by the
// app's global MSW handlers (src/app/files/mock/handlers/files.ts, PACT-924)
// with a 200, so the happy-path and confirm-failure cases below exercise it
// as-is. Only the PUT-failure case below needs a scoped override.
const makeFile = (name = 'report.pdf') =>
  new File(['hello world'], name, { type: 'application/pdf' });

describe('uploadFile - PACT-580 presign -> PUT -> confirm protocol helper', () => {
  it('returns ok with the confirmed fileId on the full happy path', async () => {
    const result = await uploadFile(makeFile());

    expect(result).toEqual({ ok: true, fileId: expect.any(String) });
  });

  it('fails at the presign step and reports its status', async () => {
    server.use(
      http.post('*/v1/files', () =>
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

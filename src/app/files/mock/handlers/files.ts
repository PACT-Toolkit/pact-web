import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import { type FilesFileResponse } from '@/src/__codegen__/rest/files';
import { isScanBlocked } from '@/src/app/files/domain/file_scan_status';
import { MINT_FAILURE_FILE_ID } from '@/src/app/files/mock/data/files';

// How long a "processing" row stays processing before the mock pipeline
// (MIME/AV/thumbnail) settles it into a terminal state. Mirrors
// pact-files' real async lifecycle closely enough for FilesWorkbench's
// polling (POLL_INTERVAL_MS) to have something to observe.
const PROCESSING_DURATION_MS = 3_000;

// How long a "scanning" row stays scanning, measured from the first time the
// mock serves it, before it settles to "allowed". The real scan takes minutes;
// this is long enough to watch the row change without a reload.
const SCANNING_DURATION_MS = 12_000;

// Content types the real pipeline scans (text, markdown, CSV, TSV, JSON).
const isScannableType = (contentType: string | undefined): boolean =>
  contentType !== undefined &&
  (contentType.startsWith('text/') || contentType === 'application/json');

// First time each scanning row was served. A Map, not a field on the row: it
// is mock-only bookkeeping that must not leak into the response.
const scanningSince = new Map<string, number>();

// Advances a row's lifecycle at read time (list/get) rather than via a real
// timer - avoids leaking timers across Vitest runs (same reasoning as
// benchmark.ts's advanceJob, which uses the same read-time-advance pattern for
// job polling). "processing" becomes "ready" after PROCESSING_DURATION_MS,
// entering the scan ("scanning" for scannable types, "skipped" otherwise);
// "scanning" becomes "allowed" after SCANNING_DURATION_MS.
const settle = (file: FilesFileResponse): FilesFileResponse => {
  if (file.status === 'processing') {
    const age = Date.now() - Date.parse(file.updatedAt ?? '');
    if (age < PROCESSING_DURATION_MS) return file;

    return (
      db.files.update(
        (f) => f.id === file.id,
        (f) => ({
          ...f,
          status: 'ready',
          scanStatus: isScannableType(f.contentType) ? 'scanning' : 'skipped',
          updatedAt: new Date().toISOString(),
        })
      ) ?? file
    );
  }

  if (file.scanStatus === 'scanning') {
    const id = file.id ?? '';
    const since = scanningSince.get(id) ?? Date.now();
    scanningSince.set(id, since);
    if (Date.now() - since < SCANNING_DURATION_MS) return file;

    return (
      db.files.update(
        (f) => f.id === file.id,
        (f) => ({
          ...f,
          scanStatus: 'allowed',
          scannedAt: new Date().toISOString(),
        })
      ) ?? file
    );
  }

  return file;
};

export const handlers: RequestHandler[] = [
  http.get('*/v1/files', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const offset = Number(url.searchParams.get('offset') ?? 0);

    const rows = db.files
      .getAll()
      .filter((f) => f.status !== 'deleted')
      .map(settle);

    return HttpResponse.json({
      files: rows.slice(offset, offset + limit),
      total: rows.length,
    });
  }),

  http.post('*/v1/files', async ({ request }) => {
    const body = (await request.json()) as {
      filename: string;
      contentType: string;
      sizeBytes: number;
      purpose?: string;
    };
    const created = db.files.create({
      id: uuidv4(),
      filename: body.filename,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      purpose: body.purpose ?? 'attachment',
      status: 'pending',
      storageKey: `mock/${body.filename}`,
    });

    return HttpResponse.json(
      {
        fileId: created.id,
        uploadUrl: `https://mock-object-storage.local/upload/${created.id}`,
        uploadUrlExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      { status: 201 }
    );
  }),

  // pact-web's presign step hands the browser a
  // mock-object-storage.local URL to PUT the raw bytes to directly, bypassing
  // the Next.js proxy entirely (same as a real S3 presigned URL would). That
  // origin was never registered as an MSW handler, so the PUT fell through
  // to the real network and hung/failed, leaving uploadFile() stuck before
  // it ever reached the confirm step. This answers the PUT the same way a
  // real presigned object-storage endpoint would: 200 with an ETag header.
  http.put(
    'https://mock-object-storage.local/upload/*',
    () =>
      new HttpResponse(null, { status: 200, headers: { ETag: '"mock-etag"' } })
  ),

  http.post('*/v1/files/:id/confirm', ({ params }) => {
    const { id } = params as { id: string };
    const updated = db.files.update(
      (f) => f.id === id,
      (f) => ({
        ...f,
        status: 'processing',
        updatedAt: new Date().toISOString(),
      })
    );
    if (!updated) {
      return HttpResponse.json({ error: 'file not found' }, { status: 404 });
    }

    return HttpResponse.json(updated);
  }),

  http.get('*/v1/files/:id', ({ params }) => {
    const { id } = params as { id: string };

    // regression fixture: always fail the mint for this one file, even
    // though it is otherwise "ready". See mock/data/files.ts's docblock.
    if (id === MINT_FAILURE_FILE_ID) {
      return HttpResponse.json(
        { error: 'simulated download-url mint failure' },
        { status: 500 }
      );
    }

    const file = db.files.findFirst((f) => f.id === id);
    if (!file) {
      return HttpResponse.json({ error: 'file not found' }, { status: 404 });
    }
    const settled = settle(file);
    // Like the real gateway: no download URL until the file is ready, and
    // none for a file the scan blocked (deliberate, not an error).
    if (settled.status !== 'ready' || isScanBlocked(settled.scanStatus)) {
      return HttpResponse.json({ file: settled });
    }

    return HttpResponse.json({
      file: settled,
      downloadUrl: `https://mock-object-storage.local/${settled.storageKey}?signed=1`,
      downloadUrlExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  }),

  http.delete('*/v1/files/:id', ({ params }) => {
    const { id } = params as { id: string };
    const updated = db.files.update(
      (f) => f.id === id,
      (f) => ({ ...f, status: 'deleted' })
    );
    if (!updated) {
      return HttpResponse.json({ error: 'file not found' }, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),
];

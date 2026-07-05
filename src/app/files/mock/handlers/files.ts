import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import {
  type FileRecord,
  FileRecordStatus,
} from '@/src/__codegen__/rest/files';
import { MINT_FAILURE_FILE_ID } from '@/src/app/files/mock/data/files';

// How long a "processing" row stays processing before the mock pipeline
// (MIME/AV/thumbnail) settles it into a terminal state. Mirrors
// pact-files' real async lifecycle closely enough for FilesWorkbench's
// polling (POLL_INTERVAL_MS) to have something to observe.
const PROCESSING_DURATION_MS = 3_000;

// Settles a "processing" row into "ready" once PROCESSING_DURATION_MS has
// elapsed since it started processing, computed lazily at read time
// (list/get) rather than via a real timer - avoids leaking timers across
// Vitest runs (same reasoning as benchmark.ts's advanceJob, which uses the
// same read-time-advance pattern for job polling).
const settle = (file: FileRecord): FileRecord => {
  if (file.status !== FileRecordStatus.processing) return file;
  const age = Date.now() - Date.parse(file.updatedAt);
  if (age < PROCESSING_DURATION_MS) return file;

  return (
    db.files.update(
      (f) => f.id === file.id,
      (f) => ({
        ...f,
        status: FileRecordStatus.ready,
        updatedAt: new Date().toISOString(),
      })
    ) ?? file
  );
};

export const handlers: RequestHandler[] = [
  http.get('*/v1/files/', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 100);
    const offset = Number(url.searchParams.get('offset') ?? 0);

    const rows = db.files
      .getAll()
      .filter((f) => f.status !== FileRecordStatus.deleted)
      .map(settle);

    return HttpResponse.json({
      files: rows.slice(offset, offset + limit),
      total: rows.length,
    });
  }),

  http.post('*/v1/files/', async ({ request }) => {
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
      status: FileRecordStatus.pending,
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

  http.post('*/v1/files/:id/confirm', ({ params }) => {
    const { id } = params as { id: string };
    const updated = db.files.update(
      (f) => f.id === id,
      (f) => ({
        ...f,
        status: FileRecordStatus.processing,
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

    // PACT-417 fixture: always fail the mint for this one file, even
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
    if (settled.status !== FileRecordStatus.ready) {
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
      (f) => ({ ...f, status: FileRecordStatus.deleted })
    );
    if (!updated) {
      return HttpResponse.json({ error: 'file not found' }, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),
];

import { type DB } from '@/mocks/data/dbFactory';
import {
  type FileRecord,
  FileRecordStatus,
} from '@/src/__codegen__/rest/files';

// A file whose GET (download-URL mint) always fails upstream, even though
// its own status is "ready". This is the PACT-417 regression fixture: the
// old FilesWorkbench implementation re-minted this id every render forever
// with no backoff (see FilesRow.tsx's docblock for the fix). Exercising
// this row in dev:mock is how the fix is verified end-to-end - the network
// tab should show occasional SWR-backed-off retries, never a hammer.
export const MINT_FAILURE_FILE_ID = 'file-mint-fails';

export const mockFileRecord = (overrides: Partial<FileRecord>): FileRecord => {
  const now = new Date().toISOString();

  return {
    id: '',
    userId: 'mock-user',
    filename: '',
    contentType: 'application/octet-stream',
    sizeBytes: 0,
    purpose: 'attachment',
    status: FileRecordStatus.ready,
    storageKey: '',
    thumbnailKey: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const createFilesMockData = (db: DB): void => {
  db.files.create({
    id: 'file-ready-1',
    filename: 'quarterly-report.pdf',
    contentType: 'application/pdf',
    sizeBytes: 245_760,
    status: FileRecordStatus.ready,
    storageKey: 'mock/quarterly-report.pdf',
  });
  db.files.create({
    id: 'file-processing-1',
    filename: 'diagram.png',
    contentType: 'image/png',
    sizeBytes: 51_200,
    status: FileRecordStatus.processing,
    storageKey: 'mock/diagram.png',
  });
  db.files.create({
    id: 'file-rejected-1',
    filename: 'installer.exe',
    contentType: 'application/x-msdownload',
    sizeBytes: 12_288,
    status: FileRecordStatus.rejected,
    storageKey: 'mock/installer.exe',
  });
  db.files.create({
    id: MINT_FAILURE_FILE_ID,
    filename: 'broken-download-link-demo.txt',
    contentType: 'text/plain',
    sizeBytes: 2_048,
    status: FileRecordStatus.ready,
    storageKey: 'mock/broken-download-link-demo.txt',
  });
};

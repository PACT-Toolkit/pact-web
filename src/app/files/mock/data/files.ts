import { type DB } from '@/mocks/data/dbFactory';
import { type FilesFileResponse } from '@/src/__codegen__/rest/files';
import { type FileStatus } from '@/src/app/files/domain/file_status';

// A file whose GET (download-URL mint) always fails upstream, even though
// its own status is "ready". This is the regression fixture for that loop: the
// old FilesWorkbench implementation re-minted this id every render forever
// with no backoff (see FilesRow.tsx's docblock for the fix). Exercising
// this row in dev:mock is how the fix is verified end-to-end - the network
// tab should show occasional SWR-backed-off retries, never a hammer.
export const MINT_FAILURE_FILE_ID = 'file-mint-fails';

// A ready text file whose content scan has run (or is running); the mock
// pipeline only ever scans text, like the real one.
const scanFixture = (
  id: string,
  filename: string,
  contentType: string,
  scan: Pick<
    FilesFileResponse,
    'scanStatus' | 'scanStage' | 'scanReason' | 'scannedAt'
  >
): Partial<FilesFileResponse> => ({
  id,
  filename,
  contentType,
  sizeBytes: 4_096,
  status: 'ready' satisfies FileStatus,
  storageKey: `mock/${filename}`,
  ...scan,
});

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

// One file per scan verdict the real pipeline can report: passed, queued,
// running (moves to passed across refreshes, see handlers/files.ts), blocked
// with a reason that has plain wording and with one that does not (and a
// stage this build does not know), failed with two of pact-files' codes, and
// the "unknown" verdict an older files service would leave behind.
export const SCANNING_FILE_ID = 'file-scan-scanning';
export const BLOCKED_FILE_ID = 'file-scan-blocked';

const createScanVerdictMockData = (db: DB): void => {
  const fixtures = [
    scanFixture('file-scan-allowed', 'meeting-notes.txt', 'text/plain', {
      scanStatus: 'allowed',
      scannedAt: minutesAgo(12),
    }),
    scanFixture('file-scan-pending', 'export.csv', 'text/csv', {
      scanStatus: 'pending',
    }),
    scanFixture(SCANNING_FILE_ID, 'research-draft.md', 'text/markdown', {
      scanStatus: 'scanning',
    }),
    scanFixture(BLOCKED_FILE_ID, 'oversize-prompt.txt', 'text/plain', {
      scanStatus: 'blocked',
      scanStage: 'classifier',
      scanReason: 'classifier_input_too_large',
      scannedAt: minutesAgo(5),
    }),
    scanFixture(
      'file-scan-blocked-unknown',
      'hostile-input.json',
      'application/json',
      {
        scanStatus: 'blocked',
        scanStage: 'filter',
        scanReason: 'filter_hostile_v2',
        scannedAt: minutesAgo(8),
      }
    ),
    scanFixture('file-scan-failed-large', 'server-log.txt', 'text/plain', {
      scanStatus: 'failed',
      scanReason: 'too_large_to_scan',
      scannedAt: minutesAgo(20),
    }),
    scanFixture(
      'file-scan-failed-unavailable',
      'changelog.md',
      'text/markdown',
      {
        scanStatus: 'failed',
        scanReason: 'scan_unavailable',
        scannedAt: minutesAgo(3),
      }
    ),
    scanFixture(
      'file-scan-unknown',
      'legacy-upload.tsv',
      'text/tab-separated-values',
      {
        scanStatus: 'unknown',
      }
    ),
  ];
  for (const fixture of fixtures) db.files.create(fixture);
};

export const mockFileRecord = (
  overrides: Partial<FilesFileResponse>
): FilesFileResponse => {
  const now = new Date().toISOString();

  return {
    id: '',
    userId: 'mock-user',
    filename: '',
    contentType: 'application/octet-stream',
    sizeBytes: 0,
    purpose: 'attachment',
    status: 'ready' satisfies FileStatus,
    scanStatus: 'none',
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
    status: 'ready' satisfies FileStatus,
    scanStatus: 'skipped',
    storageKey: 'mock/quarterly-report.pdf',
  });
  db.files.create({
    id: 'file-processing-1',
    filename: 'diagram.png',
    contentType: 'image/png',
    sizeBytes: 51_200,
    status: 'processing' satisfies FileStatus,
    storageKey: 'mock/diagram.png',
  });
  db.files.create({
    id: 'file-rejected-1',
    filename: 'installer.exe',
    contentType: 'application/x-msdownload',
    sizeBytes: 12_288,
    status: 'rejected' satisfies FileStatus,
    storageKey: 'mock/installer.exe',
  });
  db.files.create({
    id: MINT_FAILURE_FILE_ID,
    filename: 'broken-download-link-demo.txt',
    contentType: 'text/plain',
    sizeBytes: 2_048,
    status: 'ready' satisfies FileStatus,
    scanStatus: 'allowed',
    scannedAt: minutesAgo(30),
    storageKey: 'mock/broken-download-link-demo.txt',
  });
  createScanVerdictMockData(db);
};

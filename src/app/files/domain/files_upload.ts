import { isScanInFlight } from '@/src/app/files/domain/file_scan_status';
import { DEFAULT_FILE_STATUS } from '@/src/app/files/domain/file_status';

export const POLL_INTERVAL_MS = 1500;

// A content scan can take minutes (the gateway admits one piece at a time),
// so a file that is only waiting on its scan is refreshed far less often than
// one that is still processing.
export const SCAN_POLL_INTERVAL_MS = 10_000;

export const isTerminal = (status: string) =>
  status === 'ready' || status === 'rejected' || status === 'deleted';

// How long to wait before refreshing the list again: 0 stops polling. Any
// non-terminal file keeps the short interval; otherwise a scan still in
// flight keeps the long one.
export const listRefreshInterval = (
  files: readonly { status?: string; scanStatus?: string }[]
): number => {
  if (files.some((f) => !isTerminal(f.status ?? DEFAULT_FILE_STATUS))) {
    return POLL_INTERVAL_MS;
  }

  return files.some((f) => isScanInFlight(f.scanStatus))
    ? SCAN_POLL_INTERVAL_MS
    : 0;
};

export const humanSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

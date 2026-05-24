export const POLL_INTERVAL_MS = 1500;

export const isTerminal = (status: string) =>
  status === 'ready' || status === 'rejected' || status === 'deleted';

export const humanSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

// Local-only enrichment of the server list:
//   - downloadUrl is minted per-row by calling GET /v1/files/{id}
//     for any row whose server status is "ready".
//   - error/busy are pure UI flags.
export type RowExtras = {
  downloadUrl?: string;
  error?: string;
  busy?: boolean;
};

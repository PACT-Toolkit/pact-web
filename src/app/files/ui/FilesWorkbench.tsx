'use client';

import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type FileRecord,
  type GetFileResponse,
  deleteFile,
  getFile,
  requestFileUpload,
  useListFiles,
} from '@/src/__codegen__/rest/files';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

// Poll cadence for non-terminal records. Tight at first so the UI
// feels snappy on the typical fast path (small image, no virus),
// then bounded by attempt count so a stuck record doesn't hammer
// the gateway forever. The pipeline usually finishes in <5s in dev.
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 40; // ~60s before we stop polling that row

const isTerminal = (status: string) =>
  status === 'ready' || status === 'rejected' || status === 'deleted';

const humanSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

// Local-only enrichment of the server list:
//   - downloadUrl is minted per-row by calling GET /v1/files/{id}
//     for any row whose server status is "ready" (ListFiles
//     intentionally doesn't mint URLs to avoid presign storms).
//   - pollAttempts caps the in-browser poll loop for non-terminal
//     rows so a runaway upload doesn't pin the network.
//   - error/busy are pure UI flags.
type RowExtras = {
  downloadUrl?: string;
  pollAttempts: number;
  error?: string;
  busy?: boolean;
};

export const FilesWorkbench = () => {
  const [extras, setExtras] = useState<Record<string, RowExtras>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Server-side list is the source of truth. SWR's refreshInterval
  // does the polling for us: short while anything is processing,
  // off when every row is terminal. Upload/delete mutators force a
  // refresh via the bound mutate.
  const {
    data,
    error: listError,
    isLoading,
    mutate,
  } = useListFiles({ limit: 100, offset: 0 });

  // useMemo so the array identity stays stable across renders that
  // don't actually change the list; without this, every render
  // would re-run the polling/url-mint effect.
  const serverFiles = useMemo<FileRecord[]>(
    () => (data?.status === 200 ? data.data.files : []),
    [data]
  );
  const serverTotal = data?.status === 200 ? data.data.total : 0;

  // mintDownloadURL fetches a fresh presigned GET URL for a single
  // row. Called when a row first appears in "ready" state (and the
  // user hasn't been issued a URL yet) and when the user clicks
  // Refresh. Keeping the URL local-only avoids stale URLs across
  // re-renders -- presigned URLs are short-lived and the SPA
  // controls when to refresh them.
  const mintDownloadURL = useCallback(
    async (id: string) => {
      try {
        const res = await getFile(id);
        if (res.status === 200) {
          const body = res.data as GetFileResponse;
          setExtras((prev) => ({
            ...prev,
            [id]: {
              ...(prev[id] ?? { pollAttempts: 0 }),
              downloadUrl: body.downloadUrl ?? undefined,
              error: undefined,
            },
          }));

          return body.file.status;
        }
        if (res.status === 404) {
          // Row was deleted out-of-band; the server list will catch
          // up on the next mutate(). Clear local extras for that id.
          setExtras((prev) => {
            const next = { ...prev };
            delete next[id];

            return next;
          });
          await mutate();

          return null;
        }
        setExtras((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] ?? { pollAttempts: 0 }),
            error: 'lookup failed',
          },
        }));

        return null;
      } catch {
        setExtras((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] ?? { pollAttempts: 0 }),
            error: 'network error',
          },
        }));

        return null;
      }
    },
    [mutate]
  );

  // Bag of ids whose status is still non-terminal and that haven't
  // exceeded the per-row attempt budget. Recomputed every render
  // from serverFiles+extras; cheap (<= ~100 rows).
  const pollableIDs = useMemo(
    () =>
      serverFiles
        .filter((f) => !isTerminal(f.status))
        .map((f) => f.id)
        .filter((id) => (extras[id]?.pollAttempts ?? 0) < POLL_MAX_ATTEMPTS),
    [serverFiles, extras]
  );

  // Status-poll loop. Calls mutate() (no setState) every interval
  // while at least one row is still processing. The set-state for
  // pollAttempts happens inside the interval callback so the lint
  // rule that forbids synchronous setState in effects is happy --
  // setState in a timer callback is "outside" the effect body.
  useEffect(() => {
    if (pollableIDs.length === 0) return;

    const handle = window.setInterval(() => {
      setExtras((prev) => {
        const next = { ...prev };
        for (const id of pollableIDs) {
          next[id] = {
            ...(next[id] ?? { pollAttempts: 0 }),
            pollAttempts: (next[id]?.pollAttempts ?? 0) + 1,
          };
        }

        return next;
      });
      void mutate();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(handle);
  }, [pollableIDs, mutate]);

  // URL-mint loop. Runs separately from status-poll because the
  // mint happens once per row (not on a cadence) and would otherwise
  // tangle the polling effect's deps. queueMicrotask defers the
  // setState past the effect body so the React 19 "no setState in
  // effects" lint stays happy.
  useEffect(() => {
    const readyMissingURL = serverFiles
      .filter((f) => f.status === 'ready' && !extras[f.id]?.downloadUrl)
      .map((f) => f.id);
    if (readyMissingURL.length === 0) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      for (const id of readyMissingURL) void mintDownloadURL(id);
    });

    return () => {
      cancelled = true;
    };
  }, [serverFiles, extras, mintDownloadURL]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const presign = await requestFileUpload({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        purpose: 'attachment',
      });
      if (presign.status !== 201) {
        setUploadError(
          presign.status === 401
            ? 'You are signed out.'
            : presign.status === 429
              ? 'Too many uploads — slow down.'
              : 'Could not request an upload URL.'
        );

        return;
      }
      const { fileId, uploadUrl } = presign.data;

      // Browser-to-storage PUT. The bytes go straight to MinIO / S3
      // / R2 -- pact-gateway never sees them. Content-Type must
      // match what we declared above, otherwise pact-files will
      // reject the record during ConfirmUpload.
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) {
        setUploadError(`Upload failed (HTTP ${put.status}).`);

        return;
      }

      // Confirm kicks off the async pipeline. After this lands the
      // record shows up in the server list with status=processing
      // and the polling loop takes over.
      const confirmRes = await fetch(`/v1/files/${fileId}/confirm`, {
        method: 'POST',
      });
      if (!confirmRes.ok) {
        setUploadError(
          confirmRes.status === 404
            ? 'Upload confirm failed — record not found.'
            : `Confirm failed (HTTP ${confirmRes.status}).`
        );

        return;
      }

      await mutate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    setExtras((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { pollAttempts: 0 }), busy: true },
    }));
    try {
      await deleteFile(id);
    } catch {
      // The DELETE endpoint is idempotent on the server side, so a
      // transient network error doesn't leave the system in a
      // confused state. Surface nothing to the user beyond the row
      // disappearing on the next list refresh.
    }
    setExtras((prev) => {
      const next = { ...prev };
      delete next[id];

      return next;
    });
    await mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload a file</CardTitle>
          <CardDescription>
            Pick any file. The browser will request a presigned URL from
            pact-gateway, PUT the bytes directly to object storage, and confirm
            the upload so pact-files can run MIME detection, virus scanning, and
            thumbnail generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              ref={fileInputRef}
              type="file"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            {uploading && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </span>
            )}
          </div>
          {uploadError && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {uploadError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Your uploads</CardTitle>
            <CardDescription>
              {serverTotal === 0
                ? 'No uploads yet.'
                : `${serverTotal} file${serverTotal === 1 ? '' : 's'} on the server. Status refreshes every ${POLL_INTERVAL_MS / 1000}s while anything is still processing.`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh list"
            onClick={() => void mutate()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {listError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              Could not load your files.
            </p>
          )}
          {serverFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pick a file above to get started.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {serverFiles.map((r: FileRecord) => {
                const x = extras[r.id] ?? { pollAttempts: 0 };

                return (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-4 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.filename}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <StatusBadge status={r.status} />
                        {' • '}
                        <span>{r.contentType}</span>
                        {' • '}
                        <span>{humanSize(r.sizeBytes)}</span>
                        {x.error && (
                          <span className="ml-2 text-destructive">
                            {x.error}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.status === 'ready' && x.downloadUrl && (
                        <a
                          href={x.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline"
                        >
                          Download
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${r.filename}`}
                        disabled={x.busy}
                        onClick={() => void handleDelete(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// StatusBadge maps the five lifecycle states to color cues. Kept
// inline -- five render variants don't justify a separate file.
const StatusBadge = ({ status }: { status: string }) => {
  const palette: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
    ready: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
    deleted: 'bg-muted text-muted-foreground line-through',
  };
  const cls = palette[status] ?? 'bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
    >
      {status}
    </span>
  );
};

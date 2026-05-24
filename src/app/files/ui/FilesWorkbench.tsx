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
import {
  humanSize,
  isTerminal,
  POLL_INTERVAL_MS,
  type RowExtras,
} from '@/src/app/files/domain/files_upload';
import { FilesStatusBadge } from '@/src/app/files/ui/FilesStatusBadge';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { httpClient } from '@/src/framework/http';

export const FilesWorkbench = () => {
  const [extras, setExtras] = useState<Record<string, RowExtras>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data,
    error: listError,
    isLoading,
    mutate,
  } = useListFiles(
    { limit: 100, offset: 0 },
    {
      swr: {
        refreshInterval: (latestData) => {
          const files = latestData?.status === 200 ? latestData.data.files : [];

          return files.some((f) => !isTerminal(f.status)) ? POLL_INTERVAL_MS : 0;
        },
      },
    }
  );

  const serverFiles = useMemo<FileRecord[]>(
    () => (data?.status === 200 ? data.data.files : []),
    [data]
  );
  const serverTotal = data?.status === 200 ? data.data.total : 0;

  const mintDownloadURL = useCallback(
    async (id: string) => {
      try {
        const res = await getFile(id);
        if (res.status === 200) {
          const body = res.data as GetFileResponse;
          setExtras((prev) => ({
            ...prev,
            [id]: {
              ...(prev[id] ?? {}),
              downloadUrl: body.downloadUrl ?? undefined,
              error: undefined,
            },
          }));

          return body.file.status;
        }
        if (res.status === 404) {
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
            ...(prev[id] ?? {}),
            error: 'lookup failed',
          },
        }));

        return null;
      } catch {
        setExtras((prev) => ({
          ...prev,
          [id]: {
            ...(prev[id] ?? {}),
            error: 'network error',
          },
        }));

        return null;
      }
    },
    [mutate]
  );

  // Mint download URLs for ready files that don't have one yet.
  // Runs as an effect because it's a side-effectful fetch triggered by server
  // data changes, not user action — an approved useEffect use in pact-react-patterns.
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

      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) {
        setUploadError(`Upload failed (HTTP ${put.status}).`);

        return;
      }

      await httpClient.post(`/v1/files/${fileId}/confirm`);

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
      [id]: { ...(prev[id] ?? {}), busy: true },
    }));
    try {
      await deleteFile(id);
    } catch {
      // DELETE is idempotent; transient errors resolve on next list refresh.
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
                const x = extras[r.id] ?? {};

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
                        <FilesStatusBadge status={r.status} />
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

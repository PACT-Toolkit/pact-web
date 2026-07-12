'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { type FileRecord, useListFiles } from '@/src/__codegen__/rest/files';
import {
  isTerminal,
  POLL_INTERVAL_MS,
} from '@/src/app/files/domain/files_upload';
import {
  type UploadFileFailure,
  uploadFile,
} from '@/src/app/files/domain/upload_file';
import { FilesRow } from '@/src/app/files/ui/FilesRow';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

// uploadFailureMessage maps a protocol-level upload failure onto the
// user-facing copy shown under the file picker -- upload_file.ts holds the
// protocol (which step failed, with what status), this maps it to words.
const uploadFailureMessage = (failure: UploadFileFailure): string => {
  if (failure.step === 'presign') {
    return failure.status === 401
      ? 'You are signed out.'
      : failure.status === 429
        ? 'Too many uploads - slow down.'
        : 'Could not request an upload URL.';
  }
  if (failure.step === 'put') {
    return `Upload failed (HTTP ${failure.status}).`;
  }

  return failure.status === 401
    ? 'You are signed out.'
    : failure.status === 404
      ? 'File not found.'
      : 'Could not confirm the upload.';
};

export const FilesWorkbench = () => {
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

          return files.some((f) => !isTerminal(f.status))
            ? POLL_INTERVAL_MS
            : 0;
        },
      },
    }
  );

  const serverFiles = useMemo<FileRecord[]>(
    () => (data?.status === 200 ? data.data.files : []),
    [data]
  );
  const serverTotal = data?.status === 200 ? data.data.total : 0;

  // Passed to each FilesRow so it can trigger a list refresh after a delete
  // or after discovering (via a 404 on its own download-URL mint) that its
  // file no longer exists server-side. See FilesRow.tsx for why this
  // replaces the old useEffect-driven retry loop (PACT-417).
  const refreshList = useCallback(() => {
    void mutate();
  }, [mutate]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadFile(file);
      if (!result.ok) {
        setUploadError(uploadFailureMessage(result.failure));

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
              {serverFiles.map((r: FileRecord) => (
                <FilesRow key={r.id} file={r} onListChange={refreshList} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

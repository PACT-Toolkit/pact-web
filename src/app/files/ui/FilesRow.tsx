'use client';

import { RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  type FileRecord,
  deleteFile,
  useGetFile,
} from '@/src/__codegen__/rest/files';
import { humanSize } from '@/src/app/files/domain/files_upload';
import { FilesStatusBadge } from '@/src/app/files/ui/FilesStatusBadge';
import { Button } from '@/src/components/ui/button';

// One row of the files list. Owns its own download-URL mint (GET
// /v1/files/{id}) as a per-file SWR hook, keyed by file id via the `key`
// prop on the caller's list.map(...) - each row mounts once per file and
// keeps its own SWR cache entry, so a failed mint for one file never
// affects another.
//
// PACT-417: the previous implementation minted download URLs in a
// useEffect in the parent, keyed off a `serverFiles`/`extras` dependency
// pair. A failed mint set an error flag in `extras` but never set
// `downloadUrl`, so the effect's own "still missing a URL" filter matched
// again next render, re-running the mint immediately - forever, with no
// backoff, hammering the endpoint. Routing the mint through SWR instead
// means a failure is a normal SWR error state: SWR's own exponential
// backoff governs retries, and nothing here re-triggers a fetch just
// because state changed - only mount, an explicit revalidate() call (the
// manual Retry button below), or an upstream list refresh that the file id
// disappearing from can trigger via onMissing.
export const FilesRow = ({
  file,
  onListChange,
}: {
  file: FileRecord;
  onListChange: () => void;
}) => {
  const [busy, setBusy] = useState(false);

  const {
    data,
    error,
    isLoading,
    mutate: revalidateDownloadUrl,
  } = useGetFile(file.id, {
    swr: {
      enabled: file.status === 'ready',
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (result) => {
        // The file disappeared server-side (e.g. deleted from another
        // tab/session). Tell the parent to refresh the list rather than
        // keep this row's SWR key alive against a file that no longer
        // exists.
        if (result.status === 404) onListChange();
      },
    },
  });

  const downloadUrl = data?.status === 200 ? data.data.downloadUrl : undefined;
  const isGone = data?.status === 404;
  const lookupFailed =
    Boolean(error) || (Boolean(data) && !isGone && data?.status !== 200);
  const errorLabel = error
    ? 'network error'
    : lookupFailed
      ? 'lookup failed'
      : undefined;

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteFile(file.id);
    } catch {
      // DELETE is idempotent; transient errors resolve on next list refresh.
    }
    setBusy(false);
    onListChange();
  };

  return (
    <li className="flex items-start justify-between gap-4 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{file.filename}</div>
        <div className="text-xs text-muted-foreground">
          <FilesStatusBadge status={file.status} />
          {' • '}
          <span>{file.contentType}</span>
          {' • '}
          <span>{humanSize(file.sizeBytes)}</span>
          {errorLabel && (
            <span className="ml-2 text-destructive">{errorLabel}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {file.status === 'ready' && downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            Download
          </a>
        )}
        {file.status === 'ready' && lookupFailed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Retry download link for ${file.filename}`}
            disabled={isLoading}
            onClick={() => void revalidateDownloadUrl()}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${file.filename}`}
          disabled={busy}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
};

import {
  type FileStatus,
  isFileStatus,
} from '@/src/app/files/domain/file_status';

const palette: Record<FileStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  ready: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  deleted: 'bg-muted text-muted-foreground line-through',
};

// Accepts the raw wire status (a free-form string per FilesFileResponse) so
// callers don't need to pre-narrow it -- an unrecognised value still renders
// as plain text with the neutral fallback style, rather than the component
// requiring a FileStatus its caller may not actually have.
export const FilesStatusBadge = ({ status }: { status: string }) => {
  const cls = isFileStatus(status)
    ? palette[status]
    : 'bg-muted text-muted-foreground';

  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase ${cls}`}
      data-testid="files-row-status"
    >
      {status}
    </span>
  );
};

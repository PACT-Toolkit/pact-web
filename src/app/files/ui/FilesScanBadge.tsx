import {
  type FileScanTone,
  fileScanHint,
  fileScanLabel,
  fileScanTone,
  formatScannedAt,
} from '@/src/app/files/domain/file_scan_status';

const palette: Record<Exclude<FileScanTone, 'none'>, string> = {
  progress: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  allow: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
  block: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  muted: 'bg-muted text-muted-foreground',
};

// The content-scan verdict of one file, beside FilesStatusBadge. Takes the raw
// wire scanStatus so an unrecognised or absent value renders as the neutral
// "Scan status unknown" badge, never as a pass. The words carry the meaning;
// the colour only reinforces it. The tooltip (and a screen-reader-only copy of
// it) gives the longer hint plus the scan time in the viewer's locale.
export const FilesScanBadge = ({
  scanStatus,
  scannedAt,
}: {
  scanStatus: string | undefined;
  scannedAt: string | undefined;
}) => {
  const tone = fileScanTone(scanStatus);
  if (tone === 'none') return null;

  const when = formatScannedAt(scannedAt);
  const description = [fileScanHint(scanStatus), when && `Scanned ${when}.`]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={`ml-1 inline-block whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase ${palette[tone]}`}
      title={description || undefined}
      data-testid="files-row-scan"
    >
      {fileScanLabel(scanStatus)}
      {description && <span className="sr-only">. {description}</span>}
    </span>
  );
};

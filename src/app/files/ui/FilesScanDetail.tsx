import {
  fileScanReasonText,
  fileScanStageLabel,
  isScanBlocked,
} from '@/src/app/files/domain/file_scan_status';

// The secondary line under a blocked or failed file: for a block the stage
// that stopped it and the reason, for a failure the reason alone. A reason code
// without friendly wording is shown as received, in a muted monospace style,
// like the audit views. Renders nothing when there is no stage or reason.
export const FilesScanDetail = ({
  scanStatus,
  scanStage,
  scanReason,
}: {
  scanStatus: string | undefined;
  scanStage: string | undefined;
  scanReason: string | undefined;
}) => {
  if (scanStatus !== 'blocked' && scanStatus !== 'failed') return null;

  const stage = isScanBlocked(scanStatus)
    ? fileScanStageLabel(scanStage)
    : undefined;
  const reason = fileScanReasonText(scanStatus, scanReason);
  if (!stage && !reason) return null;

  return (
    <div
      className="mt-1 break-words text-xs text-muted-foreground"
      data-testid="files-row-scan-detail"
    >
      {stage}
      {stage && reason && ': '}
      {reason &&
        (reason.verbatim ? (
          <code className="font-mono">{reason.text}</code>
        ) : (
          reason.text
        ))}
    </div>
  );
};

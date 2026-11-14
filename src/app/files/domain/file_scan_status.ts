import { reasonCodeDescription } from '@/src/framework/decisions/decision_outcome';
import { pipelineStageLabel } from '@/src/framework/decisions/pipeline_stage';

// Domain-owned vocabulary for FilesFileResponse.scanStatus, the content-scan
// verdict pact-files keeps on a file. The generated type is a closed union,
// but the value is wire data, so every helper here accepts a plain string
// and degrades an unrecognised (or absent) value to 'unknown': a verdict
// this build cannot read must never look cleared.
export const FILE_SCAN_STATUSES = [
  'unknown',
  'none',
  'pending',
  'scanning',
  'allowed',
  'blocked',
  'failed',
  'skipped',
] as const;

export type FileScanStatus = (typeof FILE_SCAN_STATUSES)[number];

export const isFileScanStatus = (
  value: string | undefined
): value is FileScanStatus =>
  value !== undefined &&
  (FILE_SCAN_STATUSES as readonly string[]).includes(value);

// The wire value narrowed to the closed set; anything unrecognised is
// 'unknown'.
export const normalizeFileScanStatus = (
  value: string | undefined
): FileScanStatus => (isFileScanStatus(value) ? value : 'unknown');

// How a scan verdict is presented. 'none' renders nothing (the file has not
// reached the scan stage), 'unknown' is the neutral fallback and is never
// the allow tone.
export type FileScanTone =
  'none' | 'progress' | 'allow' | 'block' | 'warn' | 'muted';

const SCAN_TONE: Record<FileScanStatus, FileScanTone> = {
  unknown: 'muted',
  none: 'none',
  pending: 'progress',
  scanning: 'progress',
  allowed: 'allow',
  blocked: 'block',
  failed: 'warn',
  skipped: 'muted',
};

export const fileScanTone = (status: string | undefined): FileScanTone =>
  SCAN_TONE[normalizeFileScanStatus(status)];

const SCAN_LABEL: Record<FileScanStatus, string> = {
  unknown: 'Scan status unknown',
  none: '',
  pending: 'Scanning',
  scanning: 'Scanning',
  allowed: 'Scan passed',
  blocked: 'Blocked',
  failed: 'Scan failed',
  skipped: 'Not scanned',
};

export const fileScanLabel = (status: string | undefined): string =>
  SCAN_LABEL[normalizeFileScanStatus(status)];

// Longer wording for the badge tooltip and screen readers, for the states
// whose label alone does not say what happened.
const SCAN_HINT: Partial<Record<FileScanStatus, string>> = {
  unknown: 'The files service reported no scan verdict for this file.',
  pending: 'The scan is queued. It can take a few minutes.',
  scanning: 'The scan is running. It can take a few minutes.',
  skipped:
    'Only text, Markdown, CSV, TSV and JSON files are scanned. This file type is not.',
  failed: 'The scan could not complete, so this file is not cleared.',
};

export const fileScanHint = (status: string | undefined): string | undefined =>
  SCAN_HINT[normalizeFileScanStatus(status)];

// Scan states that are still moving, so the list keeps refreshing.
export const isScanInFlight = (status: string | undefined): boolean =>
  status === 'pending' || status === 'scanning';

export const isScanBlocked = (status: string | undefined): boolean =>
  status === 'blocked';

// Plain words for the codes pact-files itself reports when a scan fails. A
// Map, not an object literal: the code is wire data, and a plain-object
// lookup would also match inherited keys such as "constructor".
const SCAN_FAILED_REASON_DESCRIPTION = new Map<string, string>([
  ['too_large_to_scan', 'Text is over the 1 MiB scan limit'],
  ['scan_unavailable', 'The scanner stayed unavailable'],
  ['scan_rejected', 'The scanner refused the text as invalid'],
  ['piece_too_large', 'A piece of the text was too large to scan'],
  ['object_unreadable', 'The stored file could not be read'],
]);

export type FileScanReasonText = {
  text: string;
  // True when the code has no friendly wording and is shown as received,
  // so the UI can set it in a muted monospace style.
  verbatim: boolean;
};

// The reason line for a blocked or failed verdict. A blocked reason reuses
// the shared decision vocabulary, a failed one the pact-files codes above;
// an unknown code is returned verbatim. undefined when there is nothing to
// show.
export const fileScanReasonText = (
  status: string | undefined,
  reason: string | undefined
): FileScanReasonText | undefined => {
  if (!reason) return undefined;
  const scanStatus = normalizeFileScanStatus(status);
  const description =
    scanStatus === 'blocked'
      ? reasonCodeDescription(reason)
      : scanStatus === 'failed'
        ? SCAN_FAILED_REASON_DESCRIPTION.get(reason)
        : undefined;

  return description === undefined
    ? { text: reason, verbatim: true }
    : { text: description, verbatim: false };
};

// The stage that blocked a file, as its friendly label, or the id as received
// for a stage this build does not know.
export const fileScanStageLabel = (
  stage: string | undefined
): string | undefined =>
  stage ? (pipelineStageLabel(stage) ?? stage) : undefined;

// The scan time in the viewer's locale, or undefined when it is absent or
// not a valid timestamp.
export const formatScannedAt = (
  scannedAt: string | undefined
): string | undefined => {
  if (!scannedAt) return undefined;
  const at = new Date(scannedAt);

  return Number.isNaN(at.getTime()) ? undefined : at.toLocaleString();
};

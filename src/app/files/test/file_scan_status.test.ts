import { describe, expect, it } from 'vitest';

import {
  FILE_SCAN_STATUSES,
  fileScanHint,
  fileScanLabel,
  fileScanReasonText,
  fileScanStageLabel,
  fileScanTone,
  formatScannedAt,
  normalizeFileScanStatus,
} from '@/src/app/files/domain/file_scan_status';
import {
  listRefreshInterval,
  POLL_INTERVAL_MS,
  SCAN_POLL_INTERVAL_MS,
} from '@/src/app/files/domain/files_upload';

describe('file scan status presentation', () => {
  it.each([
    ['unknown', 'muted', 'Scan status unknown'],
    ['none', 'none', ''],
    ['pending', 'progress', 'Scanning'],
    ['scanning', 'progress', 'Scanning'],
    ['allowed', 'allow', 'Scan passed'],
    ['blocked', 'block', 'Blocked'],
    ['failed', 'warn', 'Scan failed'],
    ['skipped', 'muted', 'Not scanned'],
  ] as const)('maps %s to tone %s and label "%s"', (status, tone, label) => {
    expect(fileScanTone(status)).toBe(tone);
    expect(fileScanLabel(status)).toBe(label);
  });

  it('covers every status in the closed list', () => {
    for (const status of FILE_SCAN_STATUSES) {
      expect(normalizeFileScanStatus(status)).toBe(status);
    }
  });

  it('degrades an unrecognised or absent status to unknown, never allowed', () => {
    for (const value of ['cleared', 'ALLOWED', 'constructor', '', undefined]) {
      expect(normalizeFileScanStatus(value)).toBe('unknown');
      expect(fileScanTone(value)).toBe('muted');
      expect(fileScanTone(value)).not.toBe('allow');
      expect(fileScanLabel(value)).toBe('Scan status unknown');
    }
  });

  it('explains skipped files as text-only scanning', () => {
    expect(fileScanHint('skipped')).toMatch(/only text/i);
    expect(fileScanHint('allowed')).toBeUndefined();
  });
});

describe('fileScanReasonText', () => {
  it.each([
    ['too_large_to_scan', 'Text is over the 1 MiB scan limit'],
    ['scan_unavailable', 'The scanner stayed unavailable'],
    ['scan_rejected', 'The scanner refused the text as invalid'],
    ['piece_too_large', 'A piece of the text was too large to scan'],
    ['object_unreadable', 'The stored file could not be read'],
  ])('words the failed code %s', (code, text) => {
    expect(fileScanReasonText('failed', code)).toEqual({
      text,
      verbatim: false,
    });
  });

  it('shows an unknown failed code verbatim', () => {
    expect(fileScanReasonText('failed', 'disk_on_fire')).toEqual({
      text: 'disk_on_fire',
      verbatim: true,
    });
    expect(fileScanReasonText('failed', 'constructor')).toEqual({
      text: 'constructor',
      verbatim: true,
    });
  });

  it('reuses the shared decision vocabulary for a blocked reason', () => {
    expect(fileScanReasonText('blocked', 'classifier_input_too_large')).toEqual(
      {
        text: "Input exceeds the classifier's size limit - fail closed",
        verbatim: false,
      }
    );
    expect(fileScanReasonText('blocked', 'filter_hostile')).toEqual({
      text: 'filter_hostile',
      verbatim: true,
    });
  });

  it('has nothing to show without a reason', () => {
    expect(fileScanReasonText('blocked', undefined)).toBeUndefined();
    expect(fileScanReasonText('failed', '')).toBeUndefined();
  });
});

describe('fileScanStageLabel', () => {
  it('labels known stages and passes an unknown stage through', () => {
    expect(fileScanStageLabel('filter')).toBe('Filter');
    expect(fileScanStageLabel('sentinel')).toBe('sentinel');
    expect(fileScanStageLabel(undefined)).toBeUndefined();
    expect(fileScanStageLabel('')).toBeUndefined();
  });
});

describe('formatScannedAt', () => {
  it('formats a valid timestamp and ignores an absent or invalid one', () => {
    expect(formatScannedAt('2026-11-14T10:30:00Z')).toContain('2026');
    expect(formatScannedAt(undefined)).toBeUndefined();
    expect(formatScannedAt('not a date')).toBeUndefined();
  });
});

describe('listRefreshInterval', () => {
  it('polls fast while a file is still processing', () => {
    expect(
      listRefreshInterval([
        { status: 'processing', scanStatus: 'none' },
        { status: 'ready', scanStatus: 'scanning' },
      ])
    ).toBe(POLL_INTERVAL_MS);
  });

  it.each(['pending', 'scanning'])(
    'polls slowly while a ready file is %s its scan',
    (scanStatus) => {
      expect(listRefreshInterval([{ status: 'ready', scanStatus }])).toBe(
        SCAN_POLL_INTERVAL_MS
      );
    }
  );

  it('stops when no row is in flight', () => {
    expect(
      listRefreshInterval([
        { status: 'ready', scanStatus: 'allowed' },
        { status: 'ready', scanStatus: 'blocked' },
        { status: 'ready', scanStatus: 'failed' },
        { status: 'ready', scanStatus: 'skipped' },
        { status: 'ready', scanStatus: 'unknown' },
        { status: 'rejected', scanStatus: 'none' },
        { status: 'ready' },
      ])
    ).toBe(0);
    expect(listRefreshInterval([])).toBe(0);
  });
});

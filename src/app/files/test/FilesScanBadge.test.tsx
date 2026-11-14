import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FilesScanBadge } from '@/src/app/files/ui/FilesScanBadge';
import { FilesScanDetail } from '@/src/app/files/ui/FilesScanDetail';

describe('FilesScanBadge', () => {
  it('renders nothing for a file that has not reached the scan', () => {
    const { container } = render(
      <FilesScanBadge scanStatus="none" scannedAt={undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['pending', 'Scanning'],
    ['scanning', 'Scanning'],
    ['allowed', 'Scan passed'],
    ['blocked', 'Blocked'],
    ['failed', 'Scan failed'],
    ['skipped', 'Not scanned'],
    ['unknown', 'Scan status unknown'],
  ])('shows %s as "%s"', (scanStatus, label) => {
    render(<FilesScanBadge scanStatus={scanStatus} scannedAt={undefined} />);
    expect(screen.getByTestId('files-row-scan')).toHaveTextContent(label);
  });

  it('shows an unrecognised or absent status as unknown, never as passed', () => {
    render(
      <>
        <FilesScanBadge scanStatus="cleared" scannedAt={undefined} />
        <FilesScanBadge scanStatus={undefined} scannedAt={undefined} />
      </>
    );
    for (const badge of screen.getAllByTestId('files-row-scan')) {
      expect(badge).toHaveTextContent('Scan status unknown');
      expect(badge).not.toHaveTextContent('Scan passed');
    }
  });

  it('gives the scan time in the tooltip and to screen readers', () => {
    render(
      <FilesScanBadge scanStatus="blocked" scannedAt="2026-11-14T10:30:00Z" />
    );
    const badge = screen.getByTestId('files-row-scan');
    expect(badge.getAttribute('title')).toMatch(/Scanned .*2026/);
    expect(badge.querySelector('.sr-only')).toHaveTextContent(/Scanned/);
  });

  it('explains a skipped file in the tooltip', () => {
    render(<FilesScanBadge scanStatus="skipped" scannedAt={undefined} />);
    expect(screen.getByTestId('files-row-scan')).toHaveAttribute(
      'title',
      expect.stringMatching(/only text/i)
    );
  });
});

describe('FilesScanDetail', () => {
  it('shows the stage label and the plain reason for a block', () => {
    render(
      <FilesScanDetail
        scanStatus="blocked"
        scanStage="classifier"
        scanReason="classifier_input_too_large"
      />
    );
    expect(screen.getByTestId('files-row-scan-detail')).toHaveTextContent(
      "Classifier: Input exceeds the classifier's size limit - fail closed"
    );
  });

  it('shows an unknown blocked reason and stage verbatim, the reason in monospace', () => {
    render(
      <FilesScanDetail
        scanStatus="blocked"
        scanStage="sentinel"
        scanReason="filter_hostile_v2"
      />
    );
    const detail = screen.getByTestId('files-row-scan-detail');
    expect(detail).toHaveTextContent('sentinel: filter_hostile_v2');
    expect(detail.querySelector('code')).toHaveTextContent('filter_hostile_v2');
  });

  it('shows only the reason for a failed scan', () => {
    render(
      <FilesScanDetail
        scanStatus="failed"
        scanStage="filter"
        scanReason="too_large_to_scan"
      />
    );
    expect(screen.getByTestId('files-row-scan-detail')).toHaveTextContent(
      /^Text is over the 1 MiB scan limit$/
    );
  });

  it('renders nothing for other states', () => {
    const { container } = render(
      <FilesScanDetail scanStatus="allowed" scanStage="filter" scanReason="x" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

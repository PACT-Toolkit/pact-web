'use client';

import { Check, Copy, Download, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/src/components/ui/button';
import { triggerDownload } from '@/src/framework/helpers';

type Props = {
  codes: string[];
  // Distinguishes this list's <ul> for Playwright/Vitest lookups when a page
  // renders more than one recovery-codes surface. Defaults to a generic id
  // since most callers only ever show one at a time.
  testId?: string;
  // Stamped into the downloaded file's name. Callers share one convention
  // (`pact-recovery-codes.txt`) unless they have a reason to differ.
  filename?: string;
};

/**
 * Renders a one-time batch of MFA recovery codes: the "we'll only show
 * these once" warning, the codes themselves, and copy/download actions.
 *
 * Purely presentational and stateless with respect to the codes - the
 * caller owns fetching them and deciding when (or whether) to render this
 * at all. `codes` is never written to storage, a ref that outlives the
 * component, or logged; letting the caller unmount this component (or stop
 * passing the codes down) is what makes the display "show once" in
 * practice.
 *
 * Shared by every recovery-codes surface in the app - TOTP enrollment's
 * recovery stage, the standalone regenerate-codes settings card, and
 * passkey enrollment's first-provisioning card - so the codes markup and
 * its copy/download affordances exist in exactly one place.
 */
export const RecoveryCodesList = ({
  codes,
  testId = 'recovery-codes',
  filename = 'pact-recovery-codes.txt',
}: Props) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setCopyError(null);
    } catch {
      // Clipboard access can fail (permissions, insecure context) - say so,
      // since a user who thinks they saved the codes but didn't loses their
      // recovery path. The download button remains as the fallback.
      setCopyError('Could not copy to clipboard. Use Download instead.');
    }
  };

  const onDownload = () => {
    triggerDownload(
      new Blob([codes.join('\n')], { type: 'text/plain' }),
      filename
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 rounded-md border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
        <TriangleAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-warning"
          aria-hidden
        />
        <span>
          We&apos;ll only show these once. Save them somewhere safe - losing
          them means losing your way back in if you ever lose access to your
          other sign-in methods.
        </span>
      </p>
      <ul
        data-testid={testId}
        className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-3"
      >
        {codes.map((c) => (
          <li key={c} className="rounded bg-background px-2 py-1">
            {c}
          </li>
        ))}
      </ul>
      {copyError && (
        <p role="alert" className="text-sm text-destructive">
          {copyError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => void onCopy()}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" aria-hidden />
          ) : (
            <Copy className="mr-2 h-4 w-4" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button type="button" variant="outline" onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" aria-hidden />
          Download
        </Button>
      </div>
    </div>
  );
};

'use client';

import { Loader2, Unlink } from 'lucide-react';

import { Button } from '@/src/components/ui/button';

import { dateFormatter } from './format';
import { providerMeta } from './providers';
import { type OAuthIdentitySummary } from './types';

type Props = {
  identity: OAuthIdentitySummary;
  busy: boolean;
  onDisconnect: () => Promise<void> | void;
};

export const ConnectedIdentityRow = ({
  identity,
  busy,
  onDisconnect,
}: Props) => {
  const meta = providerMeta(identity.provider);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        {meta.iconPath ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="size-5 shrink-0"
            aria-hidden
          >
            <path d={meta.iconPath} fill="currentColor" />
          </svg>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{meta.name}</span>
          <span className="text-xs text-muted-foreground">
            Connected {dateFormatter.format(identity.connectedAt)}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onDisconnect()}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden />
            Disconnecting…
          </>
        ) : (
          <>
            <Unlink className="mr-2 h-3 w-3" aria-hidden />
            Disconnect
          </>
        )}
      </Button>
    </li>
  );
};

'use client';

import { Loader2, Smartphone } from 'lucide-react';

import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

import { dateFormatter } from './format';
import { type MfaFactor } from './types';

type Props = {
  factor: MfaFactor;
  busy: boolean;
  onRevoke: () => Promise<void> | void;
};

export const AuthSettingsTotpFactorRow = ({ factor, busy, onRevoke }: Props) => (
  <li
    className={cn(
      'flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2',
      !factor.verified && 'opacity-60'
    )}
  >
    <div className="flex items-center gap-3">
      <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          Authenticator app (TOTP)
          {factor.label ? ` · ${factor.label}` : ''}
        </span>
        <span className="text-xs text-muted-foreground">
          Added {dateFormatter.format(factor.createdAt)}
          {!factor.verified ? ' · pending verification' : ''}
        </span>
      </div>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onRevoke()}
      disabled={busy}
    >
      {busy ? (
        <>
          <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden />
          Removing…
        </>
      ) : (
        'Remove'
      )}
    </Button>
  </li>
);

'use client';

import { Check, Fingerprint, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

import { dateFormatter, formatLastUsed } from './format';
import { type Passkey } from './types';

type Props = {
  passkey: Passkey;
  busy: boolean;
  onRename: (label: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

// Single passkey row. Editing state is local — the parent only owns the
// "which passkey is being mutated" busy flag and the global error banner.
export const PasskeyRow = ({ passkey, busy, onRename, onDelete }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(passkey.label);

  const startEdit = () => {
    setDraft(passkey.label);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(passkey.label);
  };

  const submit = async () => {
    const next = draft.trim();
    if (!next) return;
    await onRename(next);
    setEditing(false);
  };

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <Fingerprint className="h-4 w-4 shrink-0" aria-hidden />
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            maxLength={64}
            className="h-8 max-w-xs"
            aria-label="Passkey name"
          />
        ) : (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {passkey.label || 'Passkey'}
            </span>
            <span className="text-xs text-muted-foreground">
              Added {dateFormatter.format(passkey.createdAt)} ·{' '}
              {formatLastUsed(passkey.lastUsedAt)}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={submit}
              disabled={busy}
              aria-label="Save name"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelEdit}
              disabled={busy}
              aria-label="Cancel rename"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={startEdit}
              disabled={busy}
              aria-label="Rename passkey"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete()}
              disabled={busy}
              aria-label="Remove passkey"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </>
        )}
      </div>
    </li>
  );
};

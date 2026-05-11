'use client';

import { Clock3, TriangleAlert } from 'lucide-react';

import { cn } from '@/src/lib/utils';

// Auth-form error block with a small visual treatment per error code.
// Rate-limit gets a clock icon and a softer copy nudge; everything else
// gets the standard destructive treatment. The component intentionally
// reads `code` AND `message` from the parent so the parent owns both
// (some routes layer extra copy on top of the mapped message).
//
// Pass `code='rate_limited'` from the /api/auth route's response body
// to opt into the friendly treatment. Pass `null` from the parent to
// hide it entirely.
type Props = {
  code: string | null | undefined;
  message: string | null | undefined;
  className?: string;
};

export const AuthErrorNotice = ({ code, message, className }: Props) => {
  if (!message) return null;

  if (code === 'rate_limited') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-foreground',
          className
        )}
      >
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive',
        className
      )}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
};

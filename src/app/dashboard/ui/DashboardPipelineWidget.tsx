import { ArrowUpRight, Lock, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

export const DashboardPipelineWidget = ({
  title,
  icon: Icon,
  href,
  hrefLabel,
  isLoading,
  error,
  forbidden,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  hrefLabel: string;
  isLoading?: boolean;
  error?: boolean;
  // True when the stats aggregate came back 403 -- a stable, expected
  // outcome for non-operator users, not a transient failure. Takes
  // priority over `error` so a caller lacking the permission never sees
  // the generic "try refreshing" copy.
  forbidden?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) => (
  <Card className="gap-4 py-5">
    <CardHeader className="px-5">
      <CardTitle className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        {title}
      </CardTitle>
      <Link
        href={href}
        className="col-start-2 row-start-1 flex items-center gap-0.5 self-start justify-self-end text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {hrefLabel}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </CardHeader>
    <CardContent className="px-5">
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : forbidden ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Insufficient permissions to view this data.
        </p>
      ) : error ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load this stage. Try refreshing in a moment.
        </p>
      ) : isEmpty ? (
        <p className="text-sm text-muted-foreground">
          {emptyText ?? 'No activity recorded yet.'}
        </p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

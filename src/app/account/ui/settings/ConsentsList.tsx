'use client';

import {
  type ConsentList,
  useGetAccountConsents,
} from '@/src/__codegen__/rest/account';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

import { ConsentBadge } from './ConsentBadge';
import { DOCUMENT_LABELS, formatRecordedAt, titleCase } from './helpers';

export const ConsentsList = () => {
  const query = useGetAccountConsents();
  const consents =
    query.data?.status === 200
      ? ((query.data.data as ConsentList).consents ?? [])
      : [];
  const isLoading = query.isLoading;
  const error = query.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consents</CardTitle>
        <CardDescription>
          Documents you have agreed to and when. The (document, version) pair is
          the legal claim; older versions remain on the audit log even if they
          aren&apos;t shown here.{' '}
          <span className="text-foreground">
            To revoke marketing email, toggle it off under Notifications.
          </span>{' '}
          To revoke acceptance of the Terms of Service or Privacy Policy,
          request account erasure under Danger zone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!!error && consents.length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            Could not load your consent history.
          </p>
        )}
        {isLoading && consents.length === 0 ? (
          <ul className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </ul>
        ) : consents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recorded consents yet. Your acceptance of the Terms of Service
            and Privacy Policy will appear here after your next sign-in.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consents.map((c) => {
              const label =
                DOCUMENT_LABELS[c.document] ?? titleCase(c.document);
              const recorded = formatRecordedAt(c.recordedAt);

              return (
                <li
                  key={`${c.document}:${c.version}`}
                  className="flex items-start justify-between gap-4 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{c.version}</span>
                      {recorded && <> • {recorded}</>}
                    </div>
                  </div>
                  <ConsentBadge granted={c.granted} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

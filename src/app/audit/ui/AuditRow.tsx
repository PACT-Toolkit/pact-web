'use client';

import { useMemo } from 'react';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { decodeAuditEventVariant } from '@/src/app/audit/domain/audit_event_variant';
import { AuditAccountRow } from '@/src/app/audit/ui/AuditAccountRow';
import { AuditAuthRow } from '@/src/app/audit/ui/AuditAuthRow';
import { AuditDecisionRow } from '@/src/app/audit/ui/AuditDecisionRow';
import { AuditFilesRow } from '@/src/app/audit/ui/AuditFilesRow';
import { AuditUnknownRow } from '@/src/app/audit/ui/AuditUnknownRow';

// Dispatches a single audit row to its topic-specific renderer. Every
// branch is exhaustive over AuditEventVariant['kind'] -- a topic we don't
// recognise (or a payload that failed to decode) always falls through to
// AuditUnknownRow rather than throwing or rendering nothing.
export const AuditRow = ({ event }: { event: AuditEvent }) => {
  const variant = useMemo(
    () => decodeAuditEventVariant(event.topic, event.payloadJson),
    [event.topic, event.payloadJson]
  );

  switch (variant.kind) {
    case 'decisions':
      return <AuditDecisionRow event={event} payload={variant.payload} />;
    case 'auth':
      return <AuditAuthRow event={event} payload={variant.payload} />;
    case 'account':
      return <AuditAccountRow event={event} payload={variant.payload} />;
    case 'files':
      return <AuditFilesRow event={event} payload={variant.payload} />;
    case 'unknown':
      return <AuditUnknownRow event={event} raw={variant.raw} />;
    default:
      // Exhaustiveness insurance (PACT-581): if AuditEventVariant ever grows
      // a new `kind` without a case above, `variant` stops being `never`
      // here and this line fails to compile instead of silently falling
      // through at runtime.
      return variant satisfies never;
  }
};

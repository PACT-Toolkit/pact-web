import { Shield } from 'lucide-react';

import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import { AuditDecisionInsights } from '@/src/app/audit/ui/AuditDecisionInsights';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';
import {
  TRAFFIC_BUCKET_LABELS,
  decisionTrafficBucket,
} from '@/src/lib/decisions/traffic_source';

// Synthetic-origin badge text: the friendly bucket label for the sources
// this fleet knows (Test Lab, Benchmark), the raw declared value for anything
// else -- in an audit trail the verbatim tag is more useful than a generic
// "Other synthetic".
const trafficBadgeText = (payload: DecisionPayload): string => {
  const bucket = decisionTrafficBucket(payload);

  return bucket === 'other'
    ? (payload.traffic_source ?? '')
    : TRAFFIC_BUCKET_LABELS[bucket];
};

// Row renderer for pact.decisions -- the allow/block engine calls. Badges
// surface the decision itself plus the reason and classifier label, since
// those are what an operator scans for first; everything else lives in
// AuditDecisionInsights behind the expand toggle. Declared synthetic traffic
// (traffic_source, PACT-484) gets an origin badge; undeclared rows are real
// client traffic and stay unbadged. A blocked decision that carries `engine`
// (PACT-745) gets a monochrome "blocked by <engine>" badge so the deciding
// stage is visible without expanding -- rows without `engine` (older
// payloads, or a decision the gateway didn't attribute) render unchanged.
export const AuditDecisionRow = ({
  event,
  payload,
}: {
  event: AuditAuditEventResponse;
  payload: DecisionPayload;
}) => (
  <AuditRowShell
    topic={event.topic ?? ''}
    createdAt={event.createdAt ?? ''}
    requestId={event.requestId}
    rawPayload={prettyPayload(event.payloadJson ?? '')}
    detail={<AuditDecisionInsights dp={payload} />}
    badges={
      <>
        {payload.decision && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
              payload.decision === 'block'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {payload.decision.toUpperCase()}
          </span>
        )}
        {payload.decision === 'block' && payload.engine && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            blocked by {payload.engine}
          </span>
        )}
        {payload.reason && (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {payload.reason}
          </code>
        )}
        {payload.classifier?.label && (
          <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
            {payload.classifier.label}
          </code>
        )}
        {payload.traffic_source && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            {trafficBadgeText(payload)}
          </span>
        )}
        {payload.policy?.verdict && (
          <Shield
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label={`policy: ${payload.policy.verdict}`}
          />
        )}
        {!payload.decision && (
          <span className="font-medium">
            {event.eventId || '(no event id)'}
          </span>
        )}
      </>
    }
  />
);

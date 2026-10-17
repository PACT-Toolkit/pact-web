import {
  type AuditAuditEventResponse,
  type AuditComplianceReportEntryResponse,
  type AuditControlStatResponse,
  type AuditQueryComplianceReportResponse,
  type AuditQueryControlStatsResponse,
} from '@/src/__codegen__/rest/audit';
import { collectDecisionControls } from '@/src/framework/decisions/control_frameworks';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/lib/decisions/decision_payload';

// Mock counterparts of pact-audit's SQL-side control aggregate and
// per-decision compliance report. Pure over the mock decisions repository so
// both handlers and the unit tests share one implementation.

const MAX_EXAMPLE_EVENT_UUIDS = 3;

export type UnixWindow = { sinceUnix?: number; untilUnix?: number };

const createdAtUnix = (event: AuditAuditEventResponse): number =>
  Math.floor(new Date(event.createdAt ?? 0).getTime() / 1000);

// Same window semantics as the gateway: sinceUnix inclusive, untilUnix
// exclusive, either bound optional.
export const eventsInUnixWindow = (
  events: AuditAuditEventResponse[],
  { sinceUnix, untilUnix }: UnixWindow
): AuditAuditEventResponse[] =>
  events.filter((event) => {
    const created = createdAtUnix(event);
    if (sinceUnix !== undefined && created < sinceUnix) return false;
    if (untilUnix !== undefined && created >= untilUnix) return false;

    return true;
  });

const eventUuid = (
  event: AuditAuditEventResponse,
  payload: DecisionPayload
): string => payload.event_uuid ?? event.id ?? '';

const tally = (
  stat: AuditControlStatResponse,
  event: AuditAuditEventResponse,
  payload: DecisionPayload
) => {
  const decision = payload.decision;
  stat.total = (stat.total ?? 0) + 1;
  if (decision === 'block') stat.block = (stat.block ?? 0) + 1;
  else if (decision === 'allow') stat.allow = (stat.allow ?? 0) + 1;
  if ((stat.exampleEventUuids?.length ?? 0) < MAX_EXAMPLE_EVENT_UUIDS) {
    stat.exampleEventUuids?.push(eventUuid(event, payload));
  }
};

const emptyStat = (
  framework: string,
  controlId: string
): AuditControlStatResponse => ({
  framework,
  controlId,
  total: 0,
  allow: 0,
  block: 0,
  exampleEventUuids: [],
});

export const computeControlStats = (
  events: AuditAuditEventResponse[],
  window: UnixWindow = {}
): AuditQueryControlStatsResponse => {
  const byControl = new Map<string, AuditControlStatResponse>();
  const unmapped = emptyStat('', '');

  for (const event of eventsInUnixWindow(events, window)) {
    const payload = parseDecisionPayload(event.payloadJson ?? '');
    if (!payload) continue;

    const controls = collectDecisionControls(payload);
    if (controls.length === 0) {
      tally(unmapped, event, payload);
      continue;
    }
    for (const control of controls) {
      const key = `${control.framework}\u0000${control.id}`;
      let stat = byControl.get(key);
      if (!stat) {
        stat = emptyStat(control.framework, control.id);
        byControl.set(key, stat);
      }
      tally(stat, event, payload);
    }
  }

  return { stats: [...byControl.values()], unmapped };
};

export const computeComplianceReport = (
  events: AuditAuditEventResponse[],
  window: UnixWindow & { limit: number; offset: number }
): AuditQueryComplianceReportResponse => {
  const { limit, offset, ...bounds } = window;

  const entries: AuditComplianceReportEntryResponse[] = [];
  const sorted = eventsInUnixWindow(events, bounds).sort(
    (a, b) => createdAtUnix(b) - createdAtUnix(a)
  );
  for (const event of sorted) {
    const payload = parseDecisionPayload(event.payloadJson ?? '');
    if (!payload) continue;

    entries.push({
      eventUuid: eventUuid(event, payload),
      requestId: event.requestId ?? '',
      decision: payload.decision ?? '',
      engine: payload.engine ?? '',
      createdAt: event.createdAt ?? '',
      controls: collectDecisionControls(payload).map((control) => ({
        framework: control.framework,
        controlId: control.id,
      })),
    });
  }

  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length,
    sinceUnix: bounds.sinceUnix ?? 0,
    untilUnix: bounds.untilUnix ?? 0,
  };
};

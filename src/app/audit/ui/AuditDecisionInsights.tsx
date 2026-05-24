import { type DecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';

export { parseDecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';

export const AuditDecisionInsights = ({ dp }: { dp: DecisionPayload }) => (
  <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
    {dp.engine && (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Engine</span>
        <code className="rounded bg-muted px-1.5 py-0.5">{dp.engine}</code>
      </div>
    )}
    {dp.classifier?.label && (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Classifier</span>
        <code className="rounded bg-muted px-1.5 py-0.5">{dp.classifier.label}</code>
        {dp.classifier.score !== undefined && dp.classifier.score > 0 && (
          <span className="font-medium">
            {(dp.classifier.score * 100).toFixed(0)}%
          </span>
        )}
      </div>
    )}
    {dp.filter?.verdict && dp.filter.verdict !== 'safe' && (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Filter</span>
        <code className="rounded bg-muted px-1.5 py-0.5">{dp.filter.verdict}</code>
        {dp.filter.rule_id && (
          <code className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {dp.filter.rule_id}
          </code>
        )}
        {dp.filter.shadow && (
          <span className="italic text-amber-500">shadow</span>
        )}
      </div>
    )}
    {dp.redactor?.verdict && dp.redactor.verdict !== 'pass_through' && (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Redactor</span>
        <code className="rounded bg-muted px-1.5 py-0.5">{dp.redactor.verdict}</code>
      </div>
    )}
    {dp.policy?.verdict && (
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Policy</span>
        <code className="rounded bg-muted px-1.5 py-0.5">{dp.policy.verdict}</code>
        {dp.policy.agent_id && (
          <span className="text-muted-foreground">agent {dp.policy.agent_id}</span>
        )}
      </div>
    )}
  </div>
);

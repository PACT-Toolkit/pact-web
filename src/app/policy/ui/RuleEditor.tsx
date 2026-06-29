'use client';

import { RefreshCw } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import {
  type PolicyRule,
  type RuleStatus,
  parseScopes,
} from '@/src/app/policy/domain/policy_rule';
import { usePolicyRules } from '@/src/app/policy/domain/use_policy_rules';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

const STATUS_CLASS: Record<RuleStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  reviewed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  published: 'bg-green-500/10 text-green-600 dark:text-green-400',
  revoked: 'bg-destructive/10 text-destructive',
  unspecified: 'bg-muted text-muted-foreground',
};

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface RuleRowProps {
  rule: PolicyRule;
  isPending: boolean;
  actionError: string | null;
  onPublish: (id: string) => void;
  onRevoke: (id: string) => void;
}

const RuleRow = ({
  rule,
  isPending,
  actionError,
  onPublish,
  onRevoke,
}: RuleRowProps) => (
  <div className="flex flex-col gap-1 px-4 py-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
          STATUS_CLASS[rule.status as RuleStatus] ?? STATUS_CLASS.unspecified
        }`}
      >
        {rule.status.toUpperCase()}
      </span>
      <span className="font-medium">{rule.name}</span>
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        v{rule.version}
      </code>
      <span className="ml-auto text-xs text-muted-foreground">
        {formatTimestamp(rule.createdAt)}
      </span>
      {rule.status === 'draft' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onPublish(rule.id)}
        >
          {isPending ? 'Publishing…' : 'Publish'}
        </Button>
      )}
      {rule.status === 'published' && (
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => onRevoke(rule.id)}
        >
          {isPending ? 'Revoking…' : 'Revoke'}
        </Button>
      )}
    </div>
    {actionError && (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {actionError}
      </p>
    )}
  </div>
);

export const RuleEditor = () => {
  const {
    rules,
    isLoading,
    isValidating,
    error,
    createRule,
    publishRule,
    revokeRule,
    refresh,
  } = usePolicyRules();

  const [name, setName] = useState('');
  const [packYaml, setPackYaml] = useState('');
  const [scopes, setScopes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tracks which rule ids have an in-flight publish/revoke request.
  const [pendingRuleIds, setPendingRuleIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  // Per-rule error messages keyed by rule id.
  const [ruleActionErrors, setRuleActionErrors] = useState<
    Record<string, string>
  >({});

  const canSubmit =
    name.trim() !== '' && packYaml.trim() !== '' && !isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createRule({
        name: name.trim(),
        packYaml,
        scopes: parseScopes(scopes),
      });
      setName('');
      setPackYaml('');
      setScopes('');
    } catch {
      setSubmitError('Failed to create rule. Is the gateway reachable?');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRuleAction = async (
    ruleId: string,
    action: (id: string) => Promise<PolicyRule>,
    errorMessage: string
  ) => {
    setPendingRuleIds((prev) => new Set([...prev, ruleId]));
    setRuleActionErrors((prev) => {
      const next = { ...prev };
      delete next[ruleId];

      return next;
    });
    try {
      await action(ruleId);
    } catch {
      setRuleActionErrors((prev) => ({ ...prev, [ruleId]: errorMessage }));
    } finally {
      setPendingRuleIds((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);

        return next;
      });
    }
  };

  const handlePublish = (ruleId: string) =>
    void handleRuleAction(
      ruleId,
      publishRule,
      'Failed to publish rule. Please try again.'
    );

  const handleRevoke = (ruleId: string) =>
    void handleRuleAction(
      ruleId,
      revokeRule,
      'Failed to revoke rule. Please try again.'
    );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New rule</CardTitle>
          <CardDescription>
            Create a Draft policy rule. It is authored under your account and
            starts unpublished — publishing is a separate review step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="block-credential-exfil"
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-pack">Pack YAML</Label>
              <textarea
                id="rule-pack"
                value={packYaml}
                onChange={(e) => setPackYaml(e.target.value)}
                placeholder={'pack: v1\nrules: []'}
                rows={6}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-scopes">Scopes</Label>
              <Input
                id="rule-scopes"
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                placeholder="read, write (comma-separated, optional)"
              />
            </div>
            {submitError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </p>
            )}
            <div>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? 'Creating…' : 'Create rule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Rules</CardTitle>
              <CardDescription>
                Authored policy rules, newest first.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={isValidating}
            >
              <RefreshCw
                className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load rules. Try refreshing in a moment.
            </p>
          )}

          {!error && isLoading && (
            <p className="text-sm text-muted-foreground">Loading rules…</p>
          )}

          {!error && !isLoading && rules.length === 0 && (
            <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              No rules authored yet. Create one above.
            </p>
          )}

          {rules.length > 0 && (
            <div className="flex flex-col divide-y rounded-md border text-sm">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  isPending={pendingRuleIds.has(rule.id)}
                  actionError={ruleActionErrors[rule.id] ?? null}
                  onPublish={handlePublish}
                  onRevoke={handleRevoke}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

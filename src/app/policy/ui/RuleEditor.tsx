'use client';

import { type FormEvent, useState } from 'react';

import {
  type PolicyRule,
  RuleActionError,
  type RuleStatus,
  parseScopes,
} from '@/src/app/policy/domain/policy_rule';
import { usePolicyRuleActions } from '@/src/app/policy/domain/use_policy_rule_actions';
import { usePolicyRules } from '@/src/app/policy/domain/use_policy_rules';
import { RefreshButton } from '@/src/components/refresh-button';
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

// RuleAction names the write the user triggered. The in-flight button label is
// derived from this, not from the optimistically-updated rule status, so a
// publish never briefly reads "Revoking…" after the badge flips.
type RuleAction = 'publish' | 'revoke';

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

// messageForRuleError maps a failed action onto an actionable, no-em-dash
// message. 400 means the rule's status changed under us; 404 means it is gone.
const messageForRuleError = (error: unknown, action: RuleAction): string => {
  const verb = action === 'publish' ? 'published' : 'revoked';

  if (error instanceof RuleActionError) {
    if (error.code === 'illegal_transition') {
      return `This rule can no longer be ${verb} because its status changed. Refresh to see the latest.`;
    }
    if (error.code === 'not_found') {
      return 'This rule no longer exists.';
    }
  }

  return action === 'publish'
    ? 'Failed to publish rule. Please try again.'
    : 'Failed to revoke rule. Please try again.';
};

interface PolicyRuleRowProps {
  rule: PolicyRule;
  pendingAction: RuleAction | null;
  actionError: string | null;
  onPublish: (id: string) => void;
  onRevoke: (id: string) => void;
}

const PolicyRuleRow = ({
  rule,
  pendingAction,
  actionError,
  onPublish,
  onRevoke,
}: PolicyRuleRowProps) => {
  // Local visual state: revoke removes live protection and is effectively
  // irreversible, so it takes a second deliberate click to confirm.
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const errorId = `rule-error-${rule.id}`;
  const describedBy = actionError ? errorId : undefined;

  const renderActions = () => {
    if (pendingAction) {
      return (
        <Button
          variant={pendingAction === 'revoke' ? 'destructive' : 'outline'}
          size="sm"
          disabled
          aria-busy
          aria-describedby={describedBy}
        >
          {pendingAction === 'publish' ? 'Publishing…' : 'Revoking…'}
        </Button>
      );
    }

    if (rule.status === 'draft') {
      return (
        <Button
          variant="outline"
          size="sm"
          aria-describedby={describedBy}
          onClick={() => onPublish(rule.id)}
        >
          Publish
        </Button>
      );
    }

    if (rule.status === 'published') {
      if (confirmingRevoke) {
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              aria-describedby={describedBy}
              onClick={() => {
                setConfirmingRevoke(false);
                onRevoke(rule.id);
              }}
            >
              Confirm revoke
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingRevoke(false)}
            >
              Cancel
            </Button>
          </div>
        );
      }

      return (
        <Button
          variant="destructive"
          size="sm"
          aria-describedby={describedBy}
          onClick={() => setConfirmingRevoke(true)}
        >
          Revoke
        </Button>
      );
    }

    return null;
  };

  return (
    <div
      className="flex flex-col gap-1 px-4 py-3"
      data-testid="policy-rule-row"
    >
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
        {renderActions()}
      </div>
      {actionError && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {actionError}
        </p>
      )}
    </div>
  );
};

export const RuleEditor = () => {
  const { rules, isLoading, isValidating, error, refresh } = usePolicyRules();
  const { createRule, publishRule, revokeRule } = usePolicyRuleActions();

  const [name, setName] = useState('');
  const [packYaml, setPackYaml] = useState('');
  const [scopes, setScopes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Maps a rule id to the in-flight action ('publish' | 'revoke'), so the row
  // can label the spinner by the action rather than the optimistic status.
  const [pendingActions, setPendingActions] = useState<
    Record<string, RuleAction>
  >({});
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

  const handleRuleAction = async (ruleId: string, action: RuleAction) => {
    setPendingActions((prev) => ({ ...prev, [ruleId]: action }));
    setRuleActionErrors((prev) => {
      const next = { ...prev };
      delete next[ruleId];

      return next;
    });
    try {
      await (action === 'publish' ? publishRule(ruleId) : revokeRule(ruleId));
    } catch (err) {
      setRuleActionErrors((prev) => ({
        ...prev,
        [ruleId]: messageForRuleError(err, action),
      }));
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[ruleId];

        return next;
      });
    }
  };

  const handlePublish = (ruleId: string) =>
    void handleRuleAction(ruleId, 'publish');

  const handleRevoke = (ruleId: string) =>
    void handleRuleAction(ruleId, 'revoke');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>New rule</CardTitle>
          <CardDescription>
            Create a Draft policy rule. It is authored under your account and
            starts unpublished. Publishing is a separate review step.
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
            <RefreshButton
              onRefresh={() => void refresh()}
              busy={isValidating}
            />
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
                <PolicyRuleRow
                  key={rule.id}
                  rule={rule}
                  pendingAction={pendingActions[rule.id] ?? null}
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

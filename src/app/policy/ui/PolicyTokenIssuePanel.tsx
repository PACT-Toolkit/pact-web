'use client';

import { Check, Copy, KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { useIssueToken } from '@/src/__codegen__/rest/policy';
import { parseScopes } from '@/src/app/policy/domain/policy_rule';
import {
  buildIssueTokenRequest,
  DEFAULT_TTL_SECONDS,
  formatExpiry,
  type IssuedToken,
  isIssueTokenInputValid,
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '@/src/app/policy/domain/policy_token';
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

// Ad-hoc capability-token issuance panel (PACT-326): mints a token via the
// real gateway endpoint POST /v1/policy/tokens so an operator can hand a
// scoped, time-limited credential to an agent without writing a rule.
// Distinct from RuleEditor (which authors the policy rules a token is
// evaluated against) and PolicyEventsFeed (which shows how tokens were
// subsequently used) -- this panel only mints.
export const PolicyTokenIssuePanel = () => {
  const [agentId, setAgentId] = useState('');
  const [toolId, setToolId] = useState('');
  const [scopes, setScopes] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState(DEFAULT_TTL_SECONDS);
  const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { trigger: issueToken, isMutating } = useIssueToken();

  const parsedScopes = parseScopes(scopes);
  const canSubmit =
    isIssueTokenInputValid({
      agentId,
      toolId,
      scopes: parsedScopes,
      ttlSeconds,
    }) && !isMutating;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Clear any prior result/error up front so a retry after a gateway
    // outage never leaves a stale token or error message on screen.
    setSubmitError(null);
    setIssuedToken(null);
    setCopied(false);

    try {
      const res = await issueToken(
        buildIssueTokenRequest({
          agentId,
          toolId,
          scopes: parsedScopes,
          ttlSeconds,
        })
      );

      if (res.status === 201) {
        setIssuedToken(res.data);
      } else {
        setSubmitError(
          typeof res.data === 'string'
            ? res.data
            : 'Failed to issue token. Please try again.'
        );
      }
    } catch {
      setSubmitError('Failed to issue token. Is the gateway reachable?');
    }
  };

  const handleCopy = async () => {
    if (!issuedToken?.token) return;
    try {
      await navigator.clipboard.writeText(issuedToken.token);
      setCopied(true);
    } catch {
      setSubmitError('Could not copy to clipboard.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden />
          Issue capability token
        </CardTitle>
        <CardDescription>
          Mint a scoped, time-limited capability token for an agent and tool
          pair via POST /v1/policy/tokens. The token is shown once here -- copy
          it before navigating away.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token-agent-id">Agent ID</Label>
              <Input
                id="token-agent-id"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="agent-alpha"
                data-testid="token-agent-id"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="token-tool-id">Tool ID</Label>
              <Input
                id="token-tool-id"
                value={toolId}
                onChange={(e) => setToolId(e.target.value)}
                placeholder="tool-search"
                data-testid="token-tool-id"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-scopes">Scopes</Label>
            <Input
              id="token-scopes"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="read, write (comma-separated, at least one required)"
              data-testid="token-scopes"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-ttl">TTL (seconds)</Label>
            <Input
              id="token-ttl"
              type="number"
              min={MIN_TTL_SECONDS}
              max={MAX_TTL_SECONDS}
              value={ttlSeconds}
              onChange={(e) => setTtlSeconds(Number(e.target.value))}
              data-testid="token-ttl"
            />
          </div>

          {submitError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="token-issue-error"
            >
              {submitError}
            </p>
          )}

          <div>
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid="token-issue-submit"
            >
              {isMutating ? 'Issuing…' : 'Issue token'}
            </Button>
          </div>
        </form>

        {issuedToken?.token && (
          <div
            className="mt-4 flex flex-col gap-2 border-t pt-4"
            data-testid="token-issue-result"
          >
            <Label>Issued token</Label>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs"
                data-testid="token-issue-value"
              >
                {issuedToken.token}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                data-testid="token-issue-copy"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {typeof issuedToken.expiresAtUnix === 'number' && (
              <span
                className="text-xs text-muted-foreground"
                data-testid="token-issue-expiry"
              >
                Expires {formatExpiry(issuedToken.expiresAtUnix)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

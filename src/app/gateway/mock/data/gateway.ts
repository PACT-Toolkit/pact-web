// Mock-mode simulation for the /gateway console. This is the shared source
// of truth for two things:
//
//   1. GET /v1/config's stateful response (owned by this module's
//      mockGatewayConfig instantiator + createGatewayConfigMockData seeder,
//      read/written by src/app/gateway/mock/handlers/gateway.ts via
//      db.gatewayConfig). Stateful (not a plain constant) since PACT-473's
//      PATCH /v1/config/enforcement needs a session-scoped value to mutate
//      -- see dbFactory.ts's singleton-entity convention.
//   2. The sandbox/diagnostics/spotlight simulation logic the shared /v1/check
//      handler (src/app/test_lab/mock/handlers/test_lab.ts) calls into --
//      same pattern as that handler already importing
//      redactor/mock/data/redactor.ts's runRedactor. There is exactly one
//      MSW handler for POST /v1/check in this app (every console -- Test
//      Lab, Classifier, Redactor -- probes through it), so a feature that
//      needs /v1/check to grow a new response field extends that shared
//      handler's mock data rather than registering a second, competing
//      handler for the same route.
//
// The seeded config intentionally sets sandboxEnabled: true and
// diagnosticsEnabled: true so the mock demo can show a live hostile
// external_ref verdict and a causal-span BLOCK example without any manual
// setup step -- real dev deployments default SANDBOX_ENABLED to false (see
// pact-gateway internal/app/config.go), which is exactly the state
// GatewaySandboxPanel's/GatewayDiagnosticsPanel's disabled-state branches
// render. use_gateway_config.test.tsx exercises that branch via an MSW
// override (Playwright has no per-test handler override mechanism in this
// repo -- see that test file's docblock).
import { type DB } from '@/mocks/data/dbFactory';
import {
  type CheckCausalSpanInfo,
  type CheckExternalRef,
  type CheckExternalRefInfo,
  type CheckExternalRefsInfo,
  type CheckSpotlightChunk,
  type CheckSpotlightInfo,
} from '@/src/__codegen__/rest/check';
import { type ConfigConfigResponse } from '@/src/__codegen__/rest/config';

export const mockGatewayConfig = (
  overrides: Partial<ConfigConfigResponse>
): ConfigConfigResponse => ({
  classifierEnforceMode: 'enforce',
  vectorEnforceMode: 'enforce',
  consensusMode: 'inline',
  consensusThreshold: 0.55,
  sandboxEnabled: true,
  sandboxIsolation: 'namespace',
  sandboxRuntimeWrapped: true,
  diagnosticsEnabled: true,
  spotlightFormat: 'xml',
  requestTimeoutSeconds: 30,
  ...overrides,
});

// createGatewayConfigMockData seeds the single db.gatewayConfig row this
// session reads and (via PATCH /v1/config/enforcement) mutates. Singleton
// entity -- exactly one row, same convention as db.accountProfile.
export const createGatewayConfigMockData = (db: DB): void => {
  db.gatewayConfig.create({});
};

// ─── sandbox simulation ───────────────────────────────────────────────────

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const refVerdict = (url: string): CheckExternalRefInfo['verdict'] => {
  const lower = url.toLowerCase();
  if (lower.includes('malicious') || lower.includes('hostile'))
    return 'hostile';
  if (lower.includes('unreachable') || lower.includes('timeout'))
    return 'unfetchable';
  if (lower.includes('suspicious')) return 'mitigated';

  return 'clean';
};

// runSandboxProbe simulates pact-gateway's sandbox re-scan stage. Returns
// undefined when the sandbox didn't run (mirrors the real gateway: the
// external_refs response field is only populated when SandboxEnabled is
// true and the request declared external_refs).
export function runSandboxProbe(
  refs: CheckExternalRef[] | undefined,
  sandboxEnabled: boolean
): CheckExternalRefsInfo | undefined {
  if (!sandboxEnabled || !refs || refs.length === 0) return undefined;

  const resolved: CheckExternalRefInfo[] = refs.map((ref) => {
    const url = ref.url ?? '';
    const verdict = refVerdict(url);

    return {
      source: ref.source,
      host: hostOf(url),
      verdict,
      purified_content:
        verdict === 'unfetchable'
          ? undefined
          : verdict === 'hostile'
            ? '[content withheld -- hostile payload detected]'
            : verdict === 'mitigated'
              ? '[injection markers stripped] Refunds ship within 5 business days.'
              : 'Welcome! Here is how to get started with your account.',
    };
  });

  return {
    scanned: resolved.length,
    blocked: resolved.filter((r) => r.verdict === 'hostile').length,
    mitigated: resolved.filter((r) => r.verdict === 'mitigated').length,
    refs: resolved,
  };
}

export const sandboxBlocked = (info: CheckExternalRefsInfo | undefined) =>
  Boolean(info && (info.blocked ?? 0) > 0);

// ─── spotlight simulation ─────────────────────────────────────────────────

const wrapChunk = (
  format: string,
  source: string,
  trust: string,
  content: string
): string => {
  if (format === 'xml')
    return `<chunk source="${source}" trust="${trust}">${content}</chunk>`;
  if (format === 'json') return JSON.stringify({ source, trust, content });

  return `>>> SOURCE:${source} TRUST:${trust} >>>\n${content}\n<<< END <<<`;
};

// runSpotlightProbe simulates pact-gateway's spotlight-wrapping stage.
// Populated on the allow path only (swagger docblock) -- callers only invoke
// this when the overall decision is "allow".
export function runSpotlightProbe(
  chunks: CheckSpotlightChunk[] | undefined,
  format: string
): CheckSpotlightInfo | undefined {
  if (!chunks || chunks.length === 0) return undefined;

  return {
    format,
    source_count: chunks.length,
    chunks: chunks.map((c) => ({
      source: c.source,
      trust: c.trust,
      wrapped: wrapChunk(
        format,
        c.source ?? '',
        c.trust ?? '',
        c.content ?? ''
      ),
    })),
  };
}

// ─── diagnostics simulation ───────────────────────────────────────────────

// computeCausalSpans locates the byte offset of the pattern that caused a
// block, so the diagnostics panel can highlight the exact substring the
// causal-diagnostic harness replayed. Returns undefined when diagnostics is
// disabled or the request wasn't blocked -- matches pact-gateway's real
// behavior ("runs counterfactual span-replay on every block decision").
export function computeCausalSpans(
  content: string,
  matchedPattern: RegExp | undefined,
  diagnosticsEnabled: boolean,
  blocked: boolean
): CheckCausalSpanInfo[] | undefined {
  if (!diagnosticsEnabled || !blocked) return undefined;
  if (!matchedPattern) return [];

  const match = matchedPattern.exec(content);
  if (!match) return [];

  return [{ start: match.index, end: match.index + match[0].length }];
}

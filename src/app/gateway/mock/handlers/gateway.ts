import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { type ConfigEnforcementPatchRequest } from '@/src/__codegen__/rest/config';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const ENFORCE_MODE_VALUES = new Set(['shadow', 'enforce']);
const CONSENSUS_MODE_VALUES = new Set(['inline', 'shadow']);
const KNOWN_PATCH_FIELDS = new Set([
  'classifierEnforceMode',
  'vectorEnforceMode',
  'consensusMode',
]);

// validateEnforcementPatch mirrors pact-gateway's PATCH /v1/config/enforcement
// validation (internal/features/config/handler.go + internal/pipeline/types.go's
// IsValidEnforceMode / IsValidConsensusMode) so the mock 400s on exactly the
// same inputs the real gateway would -- an unknown field, or a known field
// set to a value outside its accepted set. classifierEnforceMode/
// vectorEnforceMode only ever accept "shadow"/"enforce" (no "off").
const validateEnforcementPatch = (
  body: Record<string, unknown>
): string | undefined => {
  for (const field of Object.keys(body)) {
    if (!KNOWN_PATCH_FIELDS.has(field)) {
      return `unknown field "${field}"`;
    }
  }

  const { classifierEnforceMode, vectorEnforceMode, consensusMode } =
    body as ConfigEnforcementPatchRequest;

  if (
    classifierEnforceMode !== undefined &&
    !ENFORCE_MODE_VALUES.has(classifierEnforceMode)
  ) {
    return 'classifierEnforceMode must be "shadow" or "enforce"';
  }
  if (
    vectorEnforceMode !== undefined &&
    !ENFORCE_MODE_VALUES.has(vectorEnforceMode)
  ) {
    return 'vectorEnforceMode must be "shadow" or "enforce"';
  }
  if (
    consensusMode !== undefined &&
    !CONSENSUS_MODE_VALUES.has(consensusMode)
  ) {
    return 'consensusMode must be "inline" or "shadow"';
  }

  return undefined;
};

// GET /v1/config and PATCH /v1/config/enforcement are the two routes this
// feature owns outright. The other three /gateway sections (sandbox/
// diagnostics/spotlight) ride the shared POST /v1/check handler in
// src/app/test_lab/mock/handlers/test_lab.ts -- see mock/data/gateway.ts's
// docblock for why.
export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
    HttpResponse.json(db.gatewayConfig.findFirst(() => true)!)
  ),

  // PACT-472's runtime enforcement write surface (PACT-473 wires this
  // console up to it). Partial update -- omitted fields are left unchanged
  // (see MockRepository.update's mutator merging onto the existing row).
  // Session-stateful only: like the real gateway, nothing here survives a
  // restart, which for mock mode means a full page reload of the dev
  // server process (there is no persistence layer to reset either way).
  http.patch(
    `${MSW_PACT_BASE}/gateway/v1/config/enforcement`,
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const validationError = validateEnforcementPatch(body);
      if (validationError) {
        return HttpResponse.json(validationError, { status: 400 });
      }

      const patch = body as ConfigEnforcementPatchRequest;
      const updated = db.gatewayConfig.update(
        () => true,
        (config) => ({ ...config, ...patch })
      );

      return HttpResponse.json(updated);
    }
  ),
];

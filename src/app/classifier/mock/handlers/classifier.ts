import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Mirrors pact-gateway's internal/features/classifier/handler.go labelVerdict
// runtime validation, not the OpenAPI spec -- the spec's `required` list only
// names `content` (PACT-456/commit bf2c77c caught that one field up to the
// handler's runtime behavior; requestId/predictedLabel/operatorLabel are
// still undeclared, tracked as PACT-448), so the generated
// ClassifierLabelVerdictRequest type still marks those three fields
// optional. The real handler 400s unless requestId, content, predictedLabel,
// and operatorLabel are all non-empty strings; this mock enforces the same
// so dev:mock and Playwright catch a caller that forgets one.
export const handlers: RequestHandler[] = [
  http.post(
    `${MSW_PACT_BASE}/gateway/v1/classifier/label`,
    async ({ request }) => {
      const body = (await request.json()) as ClassifierLabelVerdictRequest;

      if (
        !body.requestId ||
        !body.content ||
        !body.predictedLabel ||
        !body.operatorLabel
      ) {
        return HttpResponse.text(
          'requestId, content, predictedLabel, and operatorLabel are required',
          { status: 400 }
        );
      }

      // PACT-474 note: this used to also stamp is_false_positive onto the
      // matching db.decisions row and persist the request id to
      // sessionStorage as a stand-in for a durable flag-read surface. That
      // stand-in is gone -- LabelVerdict only ever reaches pact-classifier's
      // feedback corpus (the real gateway has no read-back for it either);
      // the filter console's flagged state now comes from a real annotation
      // written via POST /v1/audit/annotations (see filter.ts's docblock and
      // audit.ts's mock handlers, both PACT-464/PACT-474), not from this
      // endpoint's side effects.

      return HttpResponse.json({
        verdictId: `verdict-${uuidv4().slice(0, 8)}`,
        created: true,
      });
    }
  ),
];

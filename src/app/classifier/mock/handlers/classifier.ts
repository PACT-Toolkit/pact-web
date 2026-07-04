import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';
import { withFalsePositiveFlag } from '@/src/app/filter/domain/filter_decision';
import { persistFalsePositiveRequestId } from '@/src/app/filter/mock/data/filter';
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

      // Mock-only side effect (PACT-325): a real pact-gateway LabelVerdict
      // call writes only to pact-classifier's feedback corpus, never back to
      // pact-audit -- there is no real read surface for "was this decision
      // labeled". This repo's dev:mock stands in for that missing surface by
      // stamping is_false_positive onto the matching db.decisions row so the
      // filter console's persisted-flag UI has a full loop to exercise within
      // the current tab (flag -> SWR revalidate -> GET /v1/audit/events
      // reflects it). It also persists the request id to sessionStorage so
      // the flag survives an actual page reload, since `db` itself is a
      // plain module-scope object re-seeded from scratch on every full
      // navigation -- see filter.ts's reapplyPersistedFalsePositiveFlags for
      // the reload side of this, and filter_false_positive.ts's docblock for
      // the full known-limitation writeup against a real gateway.
      if (body.operatorLabel === 'false_positive') {
        db.decisions.update(
          (event) => event.requestId === body.requestId,
          (event) => ({
            ...event,
            payloadJson: withFalsePositiveFlag(event.payloadJson),
          })
        );
        persistFalsePositiveRequestId(body.requestId);
      }

      return HttpResponse.json({
        verdictId: `verdict-${uuidv4().slice(0, 8)}`,
        created: true,
      });
    }
  ),
];

import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Mirrors pact-gateway's internal/features/classifier/handler.go labelVerdict
// runtime validation, not the OpenAPI spec -- the spec omits a `required`
// list entirely (tracked as PACT-448), so the generated
// ClassifierLabelVerdictRequest type marks every field optional. The real
// handler 400s unless requestId, content, predictedLabel, and operatorLabel
// are all non-empty strings; this mock enforces the same so dev:mock and
// Playwright catch a caller that forgets one (most notably `content`, the
// field the spec gets wrong).
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

      return HttpResponse.json({
        verdictId: `verdict-${uuidv4().slice(0, 8)}`,
        created: true,
      });
    }
  ),
];

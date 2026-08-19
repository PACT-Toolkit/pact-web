// pact-gateway's boundary middleware returns a non-2xx body that is either
// a plain string or a structured boundary.ErrorResponse ({ code, error }),
// depending on the endpoint (PACT-868 corrected several endpoints -- auth's
// 401s, filter/policy's 503/504, classifier's 503/504 -- from the plain
// string shape to the structured one; see each service's swagger.yaml
// under schema/). Every orval-generated REST slice re-declares its own
// structurally-identical BoundaryErrorResponse type, so this helper takes
// the shape rather than importing any one slice's type -- callers only
// ever need a display string regardless of which shape came back.
export type ServerErrorBody = {
  code?: string;
  error?: string;
};

export const extractServerErrorMessage = (
  body: string | ServerErrorBody | undefined
): string | undefined => {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body;

  return body.error ?? body.code;
};

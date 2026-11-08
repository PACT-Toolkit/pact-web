// pact-gateway's boundary middleware returns a non-2xx body that is either
// a plain string or a structured boundary.ErrorResponse ({ code, error }),
// depending on the endpoint (several endpoints were corrected -- auth's
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

// The gateway's own plain-text errors ("missing required permission") are
// one short line. Anything longer is not a message meant for the UI.
const MAX_MESSAGE_LENGTH = 200;

// An HTML tag or doctype anywhere in the text: a CDN or proxy error page
// (for example a proxy's "502: Bad gateway" document) swapped in for the
// gateway's own body.
const MARKUP_PATTERN = /<\s*[!/a-z]/i;

// The text itself when it is short single-line plain text, otherwise
// undefined, so raw upstream markup or a long page never reaches the UI.
const displayableText = (text: string): string | undefined => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return undefined;
  if (/[\r\n]/.test(trimmed) || MARKUP_PATTERN.test(trimmed)) return undefined;

  return trimmed;
};

// Most lines of a multi-line message shown before the rest is summarised.
const MAX_MESSAGE_LINES = 10;

// The text as display lines when every non-empty line is short plain text and
// there is no markup anywhere, otherwise undefined. More than
// MAX_MESSAGE_LINES lines are cut and a final "and N more" line is added.
const displayableLines = (text: string): string | undefined => {
  if (MARKUP_PATTERN.test(text)) return undefined;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return undefined;
  if (lines.some((line) => line.length > MAX_MESSAGE_LENGTH)) return undefined;
  if (lines.length <= MAX_MESSAGE_LINES) return lines.join('\n');

  const hidden = lines.length - MAX_MESSAGE_LINES;

  return [...lines.slice(0, MAX_MESSAGE_LINES), `and ${hidden} more`].join(
    '\n'
  );
};

export const extractServerErrorMessage = (
  body: string | ServerErrorBody | undefined
): string | undefined => {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return displayableText(body);

  const { error, code } = body;

  return (
    (typeof error === 'string' ? displayableText(error) : undefined) ??
    (typeof code === 'string' ? displayableText(code) : undefined)
  );
};

// Display message for a non-2xx response: the server's own message when it
// sent a displayable one, otherwise a status-based message that names the
// status so a swallowed or replaced body still leaves something actionable.
export const describeHttpFailure = (
  status: number,
  body: string | ServerErrorBody | undefined
): string =>
  extractServerErrorMessage(body) ??
  `The gateway returned an error (HTTP ${status}).`;

// Like extractServerErrorMessage, but keeps a multi-line server message (for
// example a per-row validation report) as newline-separated lines. The
// caller renders the newlines, for example with `whitespace-pre-line`.
export const extractServerErrorLines = (
  body: string | ServerErrorBody | undefined
): string | undefined => {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return displayableLines(body);

  const { error, code } = body;

  return (
    (typeof error === 'string' ? displayableLines(error) : undefined) ??
    (typeof code === 'string' ? displayableLines(code) : undefined)
  );
};

// describeHttpFailure for bodies that may span several lines.
export const describeHttpFailureLines = (
  status: number,
  body: string | ServerErrorBody | undefined
): string =>
  extractServerErrorLines(body) ??
  `The gateway returned an error (HTTP ${status}).`;

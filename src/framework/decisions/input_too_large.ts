export const INPUT_TOO_LARGE_REASON = 'input_too_large';

export interface InputTooLarge {
  inputBytes: number;
  // Absent when the 413 body carries no usable limit.
  maxInputBytes?: number;
  message: string;
}

const formatBytes = (bytes: number): string =>
  `${bytes.toLocaleString('en-US')} bytes`;

// The gateway answers content over its single input ceiling with HTTP 413 and
// a BoundaryInputTooLargeResponse body ({code, error, max_input_bytes}), not a
// decision, and audits the request as a block. Callers of /v1/check hand the
// response and the text they submitted to this one place: it narrows the 413
// and words the message, so no caller parses the body itself. The input size
// is measured on the submitted text (UTF-8 bytes, the unit the ceiling uses)
// because the 413 body carries only the limit. Returns undefined for any
// other response.
export const describeInputTooLarge = (
  response: { status: number; data: unknown },
  submittedContent: string
): InputTooLarge | undefined => {
  if (response.status !== 413) return undefined;

  const { data } = response;
  const rawLimit =
    typeof data === 'object' && data !== null
      ? (data as { max_input_bytes?: unknown }).max_input_bytes
      : undefined;
  const maxInputBytes =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0
      ? rawLimit
      : undefined;
  const inputBytes = new TextEncoder().encode(submittedContent).length;
  const size = `Input too large: ${formatBytes(inputBytes)}`;

  return {
    inputBytes,
    maxInputBytes,
    message:
      maxInputBytes === undefined
        ? size
        : `${size}, limit ${formatBytes(maxInputBytes)}`,
  };
};

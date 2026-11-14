import { type InputTooLarge } from '@/src/framework/decisions/input_too_large';

// Whether a /v1/check mutation (the generated useCheckContent hook) ended in a
// failure the console should report as "Request failed": the hook threw, or the
// gateway answered anything but 200. The generated fetcher does not throw on a
// non-2xx status, so `data` carries it. An over-ceiling 413 is not a failure
// but a size answer the caller shows through InputTooLargeNotice; pass the
// describeInputTooLarge result as `inputTooLarge` to exclude it.
export const checkRequestFailed = (
  error: unknown,
  data: { status: number } | undefined,
  inputTooLarge?: InputTooLarge
): boolean =>
  !inputTooLarge &&
  (Boolean(error) || (data !== undefined && data.status !== 200));

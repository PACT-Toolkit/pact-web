// One 429 back-off policy for every rate-limited PACT gateway call.
//
// The gateway's per-IP limiter answers HTTP 429. When the response carries a
// Retry-After header the delay honours it (RFC 9110 section 10.2.3: either a
// non-negative integer of seconds or an HTTP-date), clamped so a hostile or
// broken header cannot park a caller for minutes. Without a usable header the
// delay is a bounded exponential back-off. Imperative callers use
// retryOnRateLimit; callers that cannot loop (an SWR refreshInterval
// callback) call rateLimitDelayMs directly with the response header.

export const RATE_LIMITED_STATUS = 429;

// Upper bound for every delay this module returns, Retry-After or computed.
export const RATE_LIMIT_MAX_DELAY_MS = 30_000;

const DEFAULT_MAX_RETRIES = 8;
const DEFAULT_BASE_DELAY_MS = 500;
const DELTA_SECONDS_PATTERN = /^\d+$/;
// An HTTP-date starts with a day name (all three RFC 9110 forms do). V8's
// Date.parse alone is too lenient: it reads "-5" and "1.5" as years.
const HTTP_DATE_PATTERN = /^[A-Za-z]/;

/**
 * Parses a Retry-After header value into a delay in milliseconds, clamped to
 * RATE_LIMIT_MAX_DELAY_MS. Accepts delta-seconds ("120") and HTTP-dates
 * ("Wed, 21 Oct 2026 07:28:00 GMT"); a date in the past gives 0. Returns
 * undefined for a missing, empty, negative, fractional or otherwise
 * unparsable value so the caller falls back to its own back-off.
 */
export const parseRetryAfterMs = (
  value: string | null | undefined,
  nowMs: number = Date.now()
): number | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (DELTA_SECONDS_PATTERN.test(trimmed)) {
    return Math.min(Number(trimmed) * 1000, RATE_LIMIT_MAX_DELAY_MS);
  }

  if (!HTTP_DATE_PATTERN.test(trimmed)) return undefined;

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;

  return Math.min(Math.max(dateMs - nowMs, 0), RATE_LIMIT_MAX_DELAY_MS);
};

/**
 * Delay before the next attempt after a 429: the Retry-After header when it
 * parses, else `baseDelayMs * 2^attempt` (attempt counts from 0). Always
 * within RATE_LIMIT_MAX_DELAY_MS.
 */
export const rateLimitDelayMs = ({
  attempt,
  retryAfter,
  baseDelayMs,
  nowMs,
}: {
  attempt: number;
  retryAfter?: string | null;
  baseDelayMs: number;
  nowMs?: number;
}): number =>
  parseRetryAfterMs(retryAfter, nowMs) ??
  Math.min(baseDelayMs * 2 ** Math.max(attempt, 0), RATE_LIMIT_MAX_DELAY_MS);

/**
 * The error shape retryOnRateLimit retries: any thrown object carrying
 * `status` 429, with the response's Retry-After header copied to
 * `retryAfter` when the thrower has it.
 */
export type RateLimitedError = { status: number; retryAfter?: string | null };

const isRateLimitedError = (error: unknown): error is RateLimitedError =>
  typeof error === 'object' &&
  error !== null &&
  (error as { status?: unknown }).status === RATE_LIMITED_STATUS;

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `operation`, retrying it after a rateLimitDelayMs pause each time it
 * throws a RateLimitedError, up to `maxRetries` retries. Any other error, or
 * a 429 once the retries run out, is rethrown unchanged.
 */
export const retryOnRateLimit = async <T>(
  operation: () => Promise<T>,
  {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    sleep = sleepMs,
  }: {
    maxRetries?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {}
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRateLimitedError(error) || attempt >= maxRetries) throw error;

      await sleep(
        rateLimitDelayMs({
          attempt,
          retryAfter: error.retryAfter,
          baseDelayMs,
        })
      );
    }
  }
};

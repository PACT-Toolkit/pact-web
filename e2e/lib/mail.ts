// Reads captured emails off disk for the full-stack Playwright specs.
//
// pact-notify's dev-only LogSender (internal/mail/log_sender.go) writes
// every outbound email as an HTML file under `<pact-notify>/.dev-mail/`
// instead of calling Brevo when it's started with
// `DOPPLER_CONFIG=dev_log` (see e2e/global-setup.ts's error message).
// That sender exists specifically "so Playwright / E2E tests can read the
// verification token off the filesystem rather than poking a real inbox" -
// this module is that reader.
//
// Runs in Node (not the browser), same as lib/seed.ts.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// pact-notify resolves its default mail dir (".dev-mail") relative to its
// own process cwd when run via `make dev` from the pact-notify checkout,
// i.e. a sibling of this repo. Override via PACT_NOTIFY_MAIL_DIR_E2E if a
// dev's layout differs.
const DEFAULT_MAIL_DIR = path.resolve(
  __dirname,
  '../../../pact-notify/.dev-mail'
);

const mailDir = (): string =>
  process.env.PACT_NOTIFY_MAIL_DIR_E2E ?? DEFAULT_MAIL_DIR;

// Filenames are timestamp-prefixed (`buildFilename` in log_sender.go), so
// lexical sort is chronological. The recipient segment has `@` rewritten
// to `_at_` and unsafe characters to `_` by `sanitizeRecipient`.
const sanitizeRecipient = (email: string): string =>
  email.replace('@', '_at_').replace(/[^A-Za-z0-9._-]/g, '_');

const TOKEN_RE = /[?&]token=([A-Za-z0-9._~-]+)/;

// pact-notify's LogSender tags every captured email with its purpose (see
// `tags: %s` in internal/mail/log_sender.go). Registering a user also
// sends a "Verify your email" message (tags: verify_email) to the same
// recipient, and it lands on disk before the password-reset email in
// every spec here (register happens first). Both files match on
// recipient AND both embed a `token=` query param, so filtering by
// recipient alone can pick up the verify-email token instead of the
// reset token if the reset email hasn't been written yet when we poll -
// we must also require the password_reset tag.
const RESET_TAG = 'password_reset';

// readLatestResetToken polls the mail directory for the most recent
// password-reset email addressed to `email` and pulls the `token` query
// parameter off its reset-password link. Polls rather than reading once
// because the Kafka round-trip (pact-auth publish -> pact-notify consume
// -> file write) is asynchronous relative to the UI action that triggered
// RequestPasswordReset.
export const readLatestResetToken = async (
  email: string,
  {
    timeoutMs = 10_000,
    pollIntervalMs = 250,
  }: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<string> => {
  const recipient = sanitizeRecipient(email);
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const token = await findLatestToken(recipient);
    if (token) return token;
    if (Date.now() >= deadline) {
      throw new Error(
        `readLatestResetToken: no captured password-reset email for ${email} found under ${mailDir()} within ${timeoutMs}ms - ` +
          'is pact-notify running with DOPPLER_CONFIG=dev_log?'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
};

const findLatestToken = async (recipient: string): Promise<string | null> => {
  let entries: string[];
  try {
    entries = await readdir(mailDir());
  } catch {
    return null;
  }
  const candidates = entries
    .filter((name) => name.endsWith('.html') && name.includes(recipient))
    .sort()
    .reverse();

  for (const name of candidates) {
    const html = await readFile(path.join(mailDir(), name), 'utf8');
    if (!html.includes(RESET_TAG)) continue;
    const match = TOKEN_RE.exec(html);
    if (match) return match[1];
  }

  return null;
};

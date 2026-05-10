/**
 * Client-side HIBP k-anonymity check.
 *
 * Only the first 5 hex characters of the SHA-1 hash are sent over the
 * network — the full password never leaves the browser. This is a
 * non-blocking UX hint; the server performs its own authoritative check.
 */

export async function checkBreach(
  password: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const msgBuf = new TextEncoder().encode(password);
    const hashBuf = await crypto.subtle.digest('SHA-1', msgBuf);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal,
    });

    if (!res.ok) {
      return false;
    }

    const text = await res.text();

    return text.split('\n').some((line) => {
      const [lineSuffix, countStr] = line.split(':');

      return (
        lineSuffix?.trim().toUpperCase() === suffix &&
        parseInt(countStr?.trim() ?? '0', 10) > 0
      );
    });
  } catch {
    return false;
  }
}

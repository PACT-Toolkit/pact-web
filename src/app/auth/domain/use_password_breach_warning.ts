'use client';

import { useCallback, useRef, useState } from 'react';

import { checkBreach } from './check_breach';

// Minimum password length before we bother running the HIBP probe —
// anything shorter is already going to fail server-side validation,
// and we don't want to leak hashes for "test" / "abc" while the user
// is still typing.
const MIN_LEN_FOR_BREACH_CHECK = 15;

// Encapsulates the on-blur HIBP k-anonymity probe used by both
// `RegisterForm` and `ResetPasswordForm`. Returns the warning flag
// and a stable `onPasswordBlur` handler that callers wire to the
// password input. AbortController machinery is hidden — every blur
// cancels the previous in-flight probe so the warning never reflects
// a stale password.
//
// Intentionally not a `useEffect`-based "watch the value" hook: the
// probe is a side-effect of an interaction (blur), not of state, so
// keeping it imperative matches the user-event lifecycle.
export const usePasswordBreachWarning = () => {
  const [warning, setWarning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const onPasswordBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const pw = e.target.value;
      setWarning(false);
      abort.current?.abort();
      if (pw.length < MIN_LEN_FOR_BREACH_CHECK) return;

      const ctrl = new AbortController();
      abort.current = ctrl;
      checkBreach(pw, ctrl.signal).then((hit) => {
        if (!ctrl.signal.aborted) setWarning(hit);
      });
    },
    []
  );

  return { warning, onPasswordBlur };
};

'use client';

import { useSyncExternalStore } from 'react';

// Pessimistic SSR mount detector: returns false on the server and during
// the first client render, then flips to true after hydration. Use this
// to gate any subtree whose visibility depends on browser-only state
// (localStorage, navigator.credentials, document.visibilityState, ...).
//
// Why not just `useEffect(() => setMounted(true), [])`?
// The lint rule `react-hooks/set-state-in-effect` rejects that pattern,
// and `useSyncExternalStore` is the React-blessed alternative — it
// participates correctly in concurrent rendering and avoids an extra
// render pass from the setState.
const subscribe = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

export const useHasMounted = (): boolean =>
  useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

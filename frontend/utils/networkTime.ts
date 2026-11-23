/**
 * Synchronizes local clock drift with the network server's HTTP Date header
 * when the browser has network connectivity, and falls back smoothly to the
 * device system clock when offline.
 */
export async function fetchNetworkClockOffsetMs(): Promise<number | null> {
  if (typeof window === 'undefined' || typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  try {
    const t0 = Date.now();
    const response = await fetch(window.location.origin, {
      method: 'HEAD',
      cache: 'no-store',
    });
    const t1 = Date.now();
    const dateHeader = response.headers.get('date');
    if (!dateHeader) return null;

    const serverMs = Date.parse(dateHeader);
    if (Number.isNaN(serverMs)) return null;

    const midpointLocalMs = Math.round((t0 + t1) / 2);
    const offsetMs = serverMs - midpointLocalMs;

    // HTTP Date header has 1-second granularity; ignore sub-2s rounding variance.
    return Math.abs(offsetMs) < 2000 ? 0 : offsetMs;
  } catch {
    return null;
  }
}

export function getSyncedNow(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

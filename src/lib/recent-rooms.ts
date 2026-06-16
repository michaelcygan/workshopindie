// Client-side "don't ping-pong back into a room I just left" skip list.
// Lives in sessionStorage so it resets between sessions but persists across
// matchmaker calls during a single browsing session.

const KEY = "workshop:recent-exits";
const TTL_MS = 5 * 60 * 1000;

type Entry = { id: string; at: number };

function read(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Entry[];
    const now = Date.now();
    return parsed.filter((e) => e && e.id && now - e.at < TTL_MS);
  } catch {
    return [];
  }
}

function write(entries: Entry[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    // ignore
  }
}

/** Mark a room as recently exited so matchmaker won't re-match into it for 5 min. */
export function markRecentExit(roomId: string) {
  const next = [{ id: roomId, at: Date.now() }, ...read().filter((e) => e.id !== roomId)];
  write(next);
}

/** Get the current skip-list of room ids. */
export function recentExitIds(): string[] {
  return read().map((e) => e.id);
}

/** Forget a specific room (e.g. user explicitly rejoined it). */
export function clearRecentExit(roomId: string) {
  write(read().filter((e) => e.id !== roomId));
}

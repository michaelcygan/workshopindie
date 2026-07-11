/**
 * Tiny WebAudio chime for in-app notifications and DMs.
 * No asset download, no autoplay issues once the user has interacted with the page.
 * Respects a `localStorage` mute flag `notify:muted` so we can add a toggle later
 * without refactoring callers.
 */
let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        (window as any).AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  } catch {
    return null;
  }
}

export function isNotifySoundMuted(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem("notify:muted") === "1"; } catch { return false; }
}

export function setNotifySoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem("notify:muted", muted ? "1" : "0"); } catch { /* noop */ }
}

/**
 * Play a short two-tone chime. Cheap, safe to call from realtime handlers.
 * Debounced to at most one play per 400ms so a burst of events doesn't machine-gun.
 */
export function playNotifySound(): void {
  if (isNotifySoundMuted()) return;
  const now = Date.now();
  if (now - lastPlayedAt < 400) return;
  lastPlayedAt = now;

  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const t0 = ac.currentTime;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    gain.connect(ac.destination);

    const o1 = ac.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(880, t0);
    o1.frequency.exponentialRampToValueAtTime(1320, t0 + 0.12);
    o1.connect(gain);
    o1.start(t0);
    o1.stop(t0 + 0.3);
  } catch {
    /* noop */
  }
}

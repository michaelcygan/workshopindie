## Coordinated wave slideshow for mobile category tiles

**Goal**
Replace the per-row independent 8s interval with a shared "wave" scheduler so all rows advance once top-to-bottom (with small stagger), then the whole column pauses 2–10s before the next wave. Optionally shuffle order per wave for an ambient feel.

**Where**
`src/routes/u.$username.tsx` — `CategoryTileMedia` (~L1066–1122) and a new small coordinator alongside it. No changes to `src/styles.css`, data, or other files.

**Design**

Add a tiny module-scoped "conductor" (no context needed — mobile tiles all live in one place and mount together):

```ts
// module scope in u.$username.tsx
type Advancer = () => void;
const advancers = new Map<number, Advancer>(); // index -> callback
let waveTimer: number | null = null;
let running = false;

function scheduleNextWave() {
  const gap = 2000 + Math.random() * 8000;       // 2–10s between waves
  waveTimer = window.setTimeout(runWave, gap);
}

function runWave() {
  const indices = [...advancers.keys()];
  // Shuffle for ambient variance; comment-toggle to top-to-bottom if desired.
  for (let k = indices.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [indices[k], indices[j]] = [indices[j], indices[k]];
  }
  indices.forEach((idx, order) => {
    // 700–1400ms between rows within a wave
    const rowDelay = order * (700 + Math.random() * 700);
    window.setTimeout(() => advancers.get(idx)?.(), rowDelay);
  });
  const waveDuration = indices.length * 1400;
  waveTimer = window.setTimeout(scheduleNextWave, waveDuration);
}

function ensureRunning() {
  if (running) return;
  running = true;
  scheduleNextWave();
}
```

`CategoryTileMedia` changes:
- Remove the per-row `setInterval` and `slideDelay` timeout.
- On mount: register `() => setI((n) => (n + 1) % covers.length)` into `advancers[index]`, call `ensureRunning()`; on unmount, delete the entry (and if empty, clear `waveTimer` + reset `running`).
- Pause when tab is hidden: keep the existing `visibilitychange` guard — cancel `waveTimer` on hidden, call `scheduleNextWave()` on visible.
- Respect `prefers-reduced-motion`: reduced-motion rows don't register, so they stay still; other rows still cycle.
- Keep the Ken Burns `animationDelay: -kenBurnsDelay` per row so the drift phase stays uniquely offset.

**Result**
- Wave 1: rows advance in a random order, spaced ~0.7–1.4s apart.
- Then a 2–10s ambient pause.
- Wave 2: new random order, repeat.
- Crossfade (1200ms) and Ken Burns unchanged.

**Verification**
Preview mobile profile for ~40s and confirm: (a) rows advance in bursts, not continuously; (b) noticeable pause between bursts varies each cycle; (c) order within a burst varies; (d) reduced-motion still disables motion.
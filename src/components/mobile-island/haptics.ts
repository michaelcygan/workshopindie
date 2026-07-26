// Very light haptic tap. Silent no-op when unsupported or during SSR.
export function hapticTap(duration = 10): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(duration);
  } catch {
    // Ignore — vibration is best-effort.
  }
}

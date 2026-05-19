import { cn } from "@/lib/utils";

/**
 * Ambient, OpenAI/Stripe-style background.
 * Three palettes of soft amorphous blobs that slowly drift and crossfade.
 * Pure CSS — no video, no deps. Respects prefers-reduced-motion.
 */
export function EtherealBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden bg-[oklch(0.97_0.01_300)]",
        className,
      )}
      aria-hidden="true"
    >
      {/* Palette 1 — Stripe coral: orange → magenta → violet */}
      <div className="ethereal-palette ethereal-p1">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ff8a3d 0%, transparent 55%)", top: "-15%", right: "-10%", animationDuration: "48s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ff4d8d 0%, transparent 55%)", top: "10%", right: "10%", animationDuration: "62s", animationDelay: "-12s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #a16bff 0%, transparent 55%)", bottom: "-20%", right: "20%", animationDuration: "55s", animationDelay: "-25s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #7aa8ff 0%, transparent 55%)", top: "30%", left: "-10%", animationDuration: "70s", animationDelay: "-8s" }} />
      </div>

      {/* Palette 2 — Stripe lavender: pink → lilac → periwinkle */}
      <div className="ethereal-palette ethereal-p2">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ff7ab8 0%, transparent 55%)", top: "-10%", left: "-10%", animationDuration: "52s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #c084fc 0%, transparent 55%)", bottom: "-15%", right: "-10%", animationDuration: "66s", animationDelay: "-18s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 55%)", top: "30%", right: "20%", animationDuration: "58s", animationDelay: "-30s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ffb89c 0%, transparent 55%)", bottom: "10%", left: "30%", animationDuration: "74s", animationDelay: "-5s" }} />
      </div>

      {/* Palette 3 — Stripe sunset: amber → coral → indigo */}
      <div className="ethereal-palette ethereal-p3">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ffa84d 0%, transparent 55%)", top: "-15%", left: "20%", animationDuration: "50s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ff5e7a 0%, transparent 55%)", top: "15%", right: "-10%", animationDuration: "64s", animationDelay: "-15s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 55%)", bottom: "-15%", left: "10%", animationDuration: "57s", animationDelay: "-28s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #e879b8 0%, transparent 55%)", top: "45%", right: "30%", animationDuration: "72s", animationDelay: "-10s" }} />
      </div>

      {/* Subtle grain for organic texture */}
      <div className="absolute inset-0 grain opacity-40" />
    </div>
  );
}

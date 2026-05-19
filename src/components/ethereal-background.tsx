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
        "pointer-events-none overflow-hidden bg-[oklch(0.96_0.02_75)]",
        className,
      )}
      aria-hidden="true"
    >
      {/* Palette 1 — Sunset: amber, coral, dusty rose */}
      <div className="ethereal-palette ethereal-p1">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #f5a96b 0%, transparent 55%)", top: "-15%", left: "-10%", animationDuration: "48s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #e87c6e 0%, transparent 55%)", top: "20%", right: "-15%", animationDuration: "62s", animationDelay: "-12s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #d96a8a 0%, transparent 55%)", bottom: "-20%", left: "20%", animationDuration: "55s", animationDelay: "-25s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #f3c97a 0%, transparent 55%)", top: "40%", left: "40%", animationDuration: "70s", animationDelay: "-8s" }} />
      </div>

      {/* Palette 2 — Forest dusk: sage, teal, mossy green */}
      <div className="ethereal-palette ethereal-p2">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #6fa890 0%, transparent 55%)", top: "-10%", right: "-10%", animationDuration: "52s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #98b87a 0%, transparent 55%)", bottom: "-15%", left: "-10%", animationDuration: "66s", animationDelay: "-18s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #4f8a8b 0%, transparent 55%)", top: "30%", left: "10%", animationDuration: "58s", animationDelay: "-30s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #c4d49a 0%, transparent 55%)", bottom: "10%", right: "20%", animationDuration: "74s", animationDelay: "-5s" }} />
      </div>

      {/* Palette 3 — Twilight: plum, terracotta, deep teal */}
      <div className="ethereal-palette ethereal-p3">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #c8704a 0%, transparent 55%)", top: "-15%", left: "10%", animationDuration: "50s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #8a5a7e 0%, transparent 55%)", top: "20%", right: "-10%", animationDuration: "64s", animationDelay: "-15s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #5d8a8a 0%, transparent 55%)", bottom: "-15%", left: "30%", animationDuration: "57s", animationDelay: "-28s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #e8a07a 0%, transparent 55%)", top: "45%", left: "5%", animationDuration: "72s", animationDelay: "-10s" }} />
      </div>

      {/* Subtle grain for organic texture */}
      <div className="absolute inset-0 grain opacity-40" />
    </div>
  );
}

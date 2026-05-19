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
        "pointer-events-none overflow-hidden bg-[oklch(0.985_0.005_85)]",
        className,
      )}
      aria-hidden="true"
    >
      {/* Palette 1 — Sky / Peach / Cream */}
      <div className="ethereal-palette ethereal-p1">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #fcd9a8 0%, transparent 65%)", top: "-15%", left: "-10%", animationDuration: "48s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #bcd9f5 0%, transparent 65%)", top: "20%", right: "-15%", animationDuration: "62s", animationDelay: "-12s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #ffe9d2 0%, transparent 70%)", bottom: "-20%", left: "20%", animationDuration: "55s", animationDelay: "-25s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #f8c89a 0%, transparent 60%)", top: "40%", left: "40%", animationDuration: "70s", animationDelay: "-8s" }} />
      </div>

      {/* Palette 2 — Coral / Sky / Cream */}
      <div className="ethereal-palette ethereal-p2">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #f7a89a 0%, transparent 65%)", top: "-10%", right: "-10%", animationDuration: "52s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #b8d8f0 0%, transparent 65%)", bottom: "-15%", left: "-10%", animationDuration: "66s", animationDelay: "-18s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #f4c0b2 0%, transparent 70%)", top: "30%", left: "10%", animationDuration: "58s", animationDelay: "-30s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #fde4d6 0%, transparent 60%)", bottom: "10%", right: "20%", animationDuration: "74s", animationDelay: "-5s" }} />
      </div>

      {/* Palette 3 — Teal / Sage / Soft Navy */}
      <div className="ethereal-palette ethereal-p3">
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #a8d4c8 0%, transparent 65%)", top: "-15%", left: "10%", animationDuration: "50s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #c4d8b8 0%, transparent 65%)", top: "20%", right: "-10%", animationDuration: "64s", animationDelay: "-15s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #b0c8d8 0%, transparent 70%)", bottom: "-15%", left: "30%", animationDuration: "57s", animationDelay: "-28s" }} />
        <span className="ethereal-blob" style={{ background: "radial-gradient(circle, #d4e0c8 0%, transparent 60%)", top: "45%", left: "5%", animationDuration: "72s", animationDelay: "-10s" }} />
      </div>

      {/* Subtle grain for organic texture */}
      <div className="absolute inset-0 grain opacity-40" />
    </div>
  );
}

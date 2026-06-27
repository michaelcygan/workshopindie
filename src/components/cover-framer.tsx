import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Square, RectangleHorizontal, RectangleVertical } from "lucide-react";

export type CoverAspect = "square" | "landscape" | "portrait";
export type CoverFocal = { x: number; y: number };

const ASPECTS: { id: CoverAspect; label: string; ratio: string; Icon: typeof Square }[] = [
  { id: "portrait",  label: "Portrait",  ratio: "aspect-[4/5]",  Icon: RectangleVertical },
  { id: "square",    label: "Square",    ratio: "aspect-square", Icon: Square },
  { id: "landscape", label: "Landscape", ratio: "aspect-[16/10]",Icon: RectangleHorizontal },
];

export function aspectClassFor(a: CoverAspect | string | null | undefined): string {
  if (a === "square") return "aspect-square";
  if (a === "landscape") return "aspect-[16/10]";
  return "aspect-[4/5]"; // portrait default
}

export function focalStyle(x: number | null | undefined, y: number | null | undefined): React.CSSProperties {
  return { objectPosition: `${x ?? 50}% ${y ?? 50}%` };
}

/**
 * Cover framing chooser — pure client-side. Lets the creator pick aspect and
 * tap a focal point so a wide thumbnail (e.g. YouTube 16:9) crops well into a
 * portrait card without losing the subject. No image processing — we just
 * persist `cover_aspect` + `cover_focal_x/y` and CSS does the rest.
 */
export function CoverFramer({
  src,
  aspect,
  focal,
  onAspectChange,
  onFocalChange,
}: {
  src: string;
  aspect: CoverAspect;
  focal: CoverFocal;
  onAspectChange: (a: CoverAspect) => void;
  onFocalChange: (f: CoverFocal) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onFocalChange({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ASPECTS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAspectChange(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
              aspect === id
                ? "border-ink bg-ink text-background"
                : "border-border bg-background text-ink-soft hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-muted">Tap the image to set the focal point</span>
      </div>
      <div
        ref={previewRef}
        onClick={handleClick}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-border bg-surface-2 cursor-crosshair select-none",
          aspectClassFor(aspect),
        )}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-cover pointer-events-none"
          style={focalStyle(focal.x, focal.y)}
        />
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-lift"
          style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
        />
      </div>
    </div>
  );
}

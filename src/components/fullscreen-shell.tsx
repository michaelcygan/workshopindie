import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Generic dark fullscreen overlay used by Board and Gallery.
 * Matches the chrome of FullscreenRoom (media-panel.tsx) so the three
 * surfaces feel like one feature.
 */
export function FullscreenShell({
  title,
  badge,
  onMinimize,
  children,
}: {
  title: string;
  badge?: ReactNode;
  onMinimize: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  // Lock body scroll while open.
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-ink text-background"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <h2 className="text-xs font-medium uppercase tracking-wider text-background/70">
            {title}
          </h2>
          {badge}
        </div>
        <button
          type="button"
          onClick={onMinimize}
          className="rounded-full bg-background/10 p-2 text-background/90 hover:bg-background/15"
          aria-label="Exit fullscreen"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </header>
      <div className="flex-1 min-h-0 px-3 pb-3 md:px-6 md:pb-6">{children}</div>
    </motion.div>,
    document.body,
  );
}

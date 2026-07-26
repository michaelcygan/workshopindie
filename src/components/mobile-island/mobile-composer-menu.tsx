import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { mobileCreateActions } from "./mobile-tabs-config";
import { hapticTap } from "./haptics";
import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  menuId: string;
  isAuthed: boolean;
};

export function MobileComposerMenu({ open, onClose, menuId, isAuthed }: Props) {

  const navigate = useNavigate();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close create menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="fixed inset-0 z-[64] bg-background/40 backdrop-blur-sm md:hidden"
          />
          {/* Action stack */}
          <div
            id={menuId}
            role="menu"
            aria-label="Create"
            className={cn(
              "pointer-events-none fixed inset-x-0 z-[66] flex flex-col items-center gap-2 md:hidden",
            )}
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
          >
            {mobileCreateActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    hapticTap(10);
                    onClose();
                    navigate({ to: action.to } as never);
                  }}

                  initial={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: 10, scale: 0.96 }
                  }
                  animate={
                    reduced
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0, scale: 1 }
                  }
                  exit={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, y: 8, scale: 0.97 }
                  }
                  transition={
                    reduced
                      ? { duration: 0.12 }
                      : {
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                          delay: (mobileCreateActions.length - 1 - i) * 0.035,
                        }
                  }
                  className={cn(
                    "pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-background/95 px-3.5 py-3 text-left shadow-lift backdrop-blur-xl",
                    "w-[min(320px,calc(100vw-32px))]",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "active:scale-[0.99]",
                  )}
                >
                  <span className="gradient-warm grid h-10 w-10 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-sm">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-tight text-ink">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                      {action.description}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "./haptics";
import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  open: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaControlsId: string;
};

export const MobileComposerTrigger = forwardRef<HTMLButtonElement, Props>(
  function MobileComposerTrigger({ open, onToggle, disabled, ariaControlsId }, ref) {
    const reduced = useReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={() => {
          hapticTap(12);
          onToggle();
        }}
        disabled={disabled}
        aria-label={open ? "Close create menu" : "Open create menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={ariaControlsId}
        whileTap={reduced ? undefined : { scale: 0.92 }}
        className={cn(
          "gradient-motion relative -mt-6 grid h-12 w-12 place-items-center rounded-full",
          "text-primary-foreground shadow-lift ring-4 ring-background",
          "outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          "disabled:opacity-60",
        )}
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 30 }
          }
          className="inline-flex"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        </motion.span>
      </motion.button>
    );
  },
);

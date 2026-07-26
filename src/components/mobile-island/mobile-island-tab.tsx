import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { MobileTab } from "./mobile-tabs-config";
import { hapticTap } from "./haptics";
import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  tab: MobileTab;
  active: boolean;
  avatar?: { url?: string | null; initial: string } | null;
  layoutIdGroup: string;
};

export function MobileIslandTab({ tab, active, avatar, layoutIdGroup }: Props) {
  const reduced = useReducedMotion();
  const Icon = tab.icon;

  return (
    <Link
      to={tab.to}
      preload="intent"
      onClick={() => hapticTap(6)}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active ? "text-ink" : "text-ink-muted hover:text-ink",
        "transition-colors",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutIdGroup}
          className="absolute inset-0 -z-0 rounded-full bg-primary/12 ring-1 ring-primary/15"
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 32 }
          }
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {Icon ? (
          <Icon
            className="h-[18px] w-[18px]"
            strokeWidth={active ? 2.4 : 2}
            aria-hidden="true"
          />
        ) : (
          <Avatar className="h-[18px] w-[18px]">
            {avatar?.url ? <AvatarImage src={avatar.url} /> : null}
            <AvatarFallback className="text-[9px]">
              {avatar?.initial ?? "·"}
            </AvatarFallback>
          </Avatar>
        )}
        <motion.span
          initial={false}
          animate={
            active
              ? { width: "auto", opacity: 1, marginLeft: 2 }
              : { width: 0, opacity: 0, marginLeft: 0 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 32 }
          }
          className="overflow-hidden whitespace-nowrap text-[12px] font-semibold leading-none"
        >
          {tab.label}
        </motion.span>
      </span>
    </Link>
  );
}

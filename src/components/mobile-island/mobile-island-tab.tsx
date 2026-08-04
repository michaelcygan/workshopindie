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
      title={tab.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-11 min-w-10 items-center justify-center rounded-lg px-2 outline-none [@media(min-width:360px)]:px-2.5",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active ? "text-ink" : "text-ink-muted hover:text-ink",
        "transition-colors",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutIdGroup}
          className="absolute inset-0 -z-0 rounded-lg bg-primary/10 ring-1 ring-primary/15"
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 32 }
          }
        />
      )}
      <span className="relative z-10 inline-flex flex-col items-center justify-center gap-[3px]">
        {Icon ? (
          <Icon
            className="h-[19px] w-[19px]"
            strokeWidth={active ? 2.5 : 1.9}
            aria-hidden="true"
          />
        ) : (
          <Avatar className={cn("h-[19px] w-[19px]", active && "ring-1 ring-primary/40")}>
            {avatar?.url ? <AvatarImage src={avatar.url} /> : null}
            <AvatarFallback className="text-[9px]">
              {avatar?.initial ?? "·"}
            </AvatarFallback>
          </Avatar>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "h-[3px] w-[3px] rounded-full transition-opacity",
            active ? "bg-ink opacity-100" : "bg-transparent opacity-0",
          )}
        />
      </span>
    </Link>
  );
}

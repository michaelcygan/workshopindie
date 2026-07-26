import { useEffect, useId, useMemo, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { mobileTabs } from "./mobile-tabs-config";
import { MobileIslandTab } from "./mobile-island-tab";
import { MobileComposerTrigger } from "./mobile-composer-trigger";
import { MobileComposerMenu } from "./mobile-composer-menu";
import { getActiveTabId } from "./use-active-tab";
import { useMobileIslandVisibility } from "./use-mobile-island-visibility";
import { useKeyboardOpen } from "./use-keyboard-open";
import { useReducedMotion } from "./use-reduced-motion";

const LEFT_LAYOUT_ID = "workshop-mobile-tab-pill-left";
const RIGHT_LAYOUT_ID = "workshop-mobile-tab-pill-right";

export function MobileActionIsland() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { islandVisible, composerVisible } = useMobileIslandVisibility();
  const keyboardOpen = useKeyboardOpen();
  const reduced = useReducedMotion();

  const [composerOpen, setComposerOpen] = useState(false);
  const menuId = useId();

  const activeId = getActiveTabId(pathname);

  // Close composer on: route change, sign-out, island hidden, keyboard open.
  useEffect(() => {
    setComposerOpen(false);
  }, [pathname, user, islandVisible, composerVisible, keyboardOpen]);

  // Manage shared bottom-clearance CSS variable so pages don't over- or under-pad.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const hidden = !islandVisible || keyboardOpen;
    if (hidden) {
      root.style.setProperty("--mobile-island-clearance", "0px");
    } else {
      root.style.removeProperty("--mobile-island-clearance");
    }
    return () => {
      root.style.removeProperty("--mobile-island-clearance");
    };
  }, [islandVisible, keyboardOpen]);

  const avatar = useMemo(() => {
    if (!user) return null;
    const initial =
      ((user.user_metadata?.display_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "·")[0]?.toUpperCase() ?? "·";
    return {
      url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      initial,
    };
  }, [user]);

  if (!islandVisible) return null;

  const leftTabs = mobileTabs.filter((t) => t.side === "left");
  const rightTabs = mobileTabs.filter((t) => t.side === "right");

  const onComposerToggle = () => {
    setComposerOpen((v) => !v);
  };


  return (
    <>
      <motion.nav
        aria-label="Primary"
        initial={false}
        animate={{
          y: keyboardOpen ? 200 : 0,
          opacity: keyboardOpen ? 0 : 1,
          pointerEvents: keyboardOpen ? "none" : "auto",
        }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 30 }
        }
        className={cn(
          "fixed inset-x-0 z-[65] flex justify-center px-3 md:hidden",
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div
          className={cn(
            "flex w-full max-w-md items-center rounded-full border border-border/70 bg-background/90 px-2 py-1.5 shadow-lift backdrop-blur-md",
            composerVisible
              ? "grid grid-cols-[1fr_auto_1fr] gap-1"
              : "flex justify-around gap-1",
          )}
        >
          {/* Left group */}
          <LayoutGroup id={LEFT_LAYOUT_ID}>
            <div className="flex items-center justify-around gap-1">
              {leftTabs.map((tab) => (
                <MobileIslandTab
                  key={tab.id}
                  tab={tab}
                  active={activeId === tab.id}
                  avatar={tab.id === "you" ? avatar : null}
                  layoutIdGroup={LEFT_LAYOUT_ID}
                />
              ))}
            </div>
          </LayoutGroup>

          {/* Center composer */}
          {composerVisible && (
            <div className="flex items-start justify-center">
              <MobileComposerTrigger
                open={composerOpen}
                onToggle={onComposerToggle}
                ariaControlsId={menuId}
              />
            </div>
          )}

          {/* Right group */}
          <LayoutGroup id={RIGHT_LAYOUT_ID}>
            <div className="flex items-center justify-around gap-1">
              {rightTabs.map((tab) => (
                <MobileIslandTab
                  key={tab.id}
                  tab={tab}
                  active={activeId === tab.id}
                  avatar={tab.id === "you" ? avatar : null}
                  layoutIdGroup={RIGHT_LAYOUT_ID}
                />
              ))}
            </div>
          </LayoutGroup>
        </div>
      </motion.nav>

      <MobileComposerMenu
        open={composerOpen && composerVisible && !keyboardOpen}
        onClose={() => setComposerOpen(false)}
        menuId={menuId}
      />
    </>
  );
}

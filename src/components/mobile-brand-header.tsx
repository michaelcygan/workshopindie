import { Link } from "@tanstack/react-router";
import { NotificationsBell } from "@/components/notifications-bell";
import { MessagesInboxButton } from "@/components/messages-inbox-button";
import { SettingsMenuButton } from "@/components/settings-menu-button";

export function MobileBrandHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md md:hidden">
      <div className="flex h-11 items-center px-3">
        <Link
          to="/"
          aria-label="Home"
          className="group inline-flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-muted"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full gradient-motion" />
          <span className="font-display text-base leading-none tracking-tight text-ink">
            Workshop
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <SettingsMenuButton />
          <MessagesInboxButton />
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}

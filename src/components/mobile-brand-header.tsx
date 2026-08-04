import { Link } from "@tanstack/react-router";
import { WorkshopBrandLink } from "@/components/workshop-brand-link";
import { NotificationsBell } from "@/components/notifications-bell";
import { MessagesInboxButton } from "@/components/messages-inbox-button";
import { SettingsMenuButton } from "@/components/settings-menu-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function MobileBrandHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md md:hidden">
      <div className="flex h-11 items-center px-3">
        <WorkshopBrandLink size="compact" />
        <div className="ml-auto flex items-center gap-1">
          {loading ? null : user ? (
            <>
              <SettingsMenuButton />
              <MessagesInboxButton />
              <NotificationsBell />
            </>
          ) : (
            <>
              <Link to="/login">
                <Button size="sm" variant="ghost" className="h-8 px-3 text-xs">
                  Sign in
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="h-8 px-3 text-xs">
                  Join
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

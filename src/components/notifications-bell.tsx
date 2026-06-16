import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Mail, UserPlus, MessageCircle, CreditCard, Sparkles, Radio, Gift } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markAllNotificationsRead } from "@/lib/notifications.functions";
import { formatRoomTitle } from "@/lib/instant";

type Row = {
  id: string;
  kind: string;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, any>;
  read_at: string | null;
  created_at: string;
};

const ICONS: Record<string, typeof Bell> = {
  dm: MessageCircle,
  follow: UserPlus,
  collab_invite: Mail,
  collab_application: Mail,
  work_credit: Sparkles,
  payment_failed: CreditCard,
  comp_redeemed: Sparkles,
  workshop_starting: Radio,
  workshop_now_live: Radio,
  workshop_ran_without_you: Radio,
  workshop_live: Radio,
  referral_joined: UserPlus,
  referral_reward_earned: Gift,
  first_work_shipped: Sparkles,
  work_published: Sparkles,
  collab_first_ship: Sparkles,
};

function labelFor(n: Row): { title: string; subtitle: string; href: string } {
  const actor = (n.payload?.actor_name as string) || (n.payload?.sender_name as string) || "Someone";
  const actorUsername = (n.payload?.actor_username as string) || undefined;
  const wsSlug = (n.payload?.slug as string) || undefined;
  const wsTitle = (n.payload?.title as string) || "A Workshop";
  switch (n.kind) {
    case "dm":
      return {
        title: `${actor} sent you a message`,
        subtitle: (n.payload?.preview as string) ?? "",
        href: n.payload?.conversation_id ? `/dms/${n.payload.conversation_id}` : "/dms",
      };
    case "collab_application": {
      const collabTitle = (n.payload?.collab_title as string) || "your collab";
      const collabSlug = (n.payload?.collab_slug as string) || undefined;
      const convId = (n.payload?.conversation_id as string) || undefined;
      return {
        title: `${actor} applied to ${collabTitle}`,
        subtitle: (n.payload?.preview as string) ?? "",
        href: convId ? `/dms/${convId}` : collabSlug ? `/collab/${collabSlug}` : "/collab",
      };
    }
    case "follow":
      return {
        title: `${actor} followed you`,
        subtitle: "",
        href: actorUsername ? `/u/${actorUsername}` : "/me",
      };

    case "referral_joined":
      return {
        title: `${actor} joined via your link`,
        subtitle: "Say hi — they came from your invite.",
        href: actorUsername ? `/u/${actorUsername}` : "/me",
      };
    case "referral_reward_earned": {
      const applied = n.payload?.status === "applied";
      return {
        title: applied ? "You earned a free month of Plus 🎁" : "Free month banked",
        subtitle: applied
          ? `Thanks for referring ${actor}. We added 30 days to your next bill.`
          : `${actor} went Plus — we'll apply your free month when you upgrade.`,
        href: "/refer",
      };
    }
    case "first_work_shipped":
      return {
        title: `${actor} just shipped their first Work`,
        subtitle: (n.payload?.title as string) ?? "",
        href: n.payload?.slug ? `/works/${n.payload.slug}` : "/",
      };
    case "work_published":
      return {
        title: `${actor} published a Work`,
        subtitle: (n.payload?.title as string) ?? "",
        href: n.payload?.slug ? `/works/${n.payload.slug}` : "/",
      };
    case "collab_first_ship":
      return {
        title: `${actor} shipped — you're credited`,
        subtitle: (n.payload?.title as string) ?? "",
        href: n.payload?.slug ? `/works/${n.payload.slug}` : "/",
      };
    case "workshop_starting":
      return { title: `${wsTitle} is starting`, subtitle: "Join now — your seat's open.", href: wsSlug ? `/workshops/${wsSlug}` : "/workshops" };
    case "workshop_now_live":
      return { title: `${wsTitle} is live`, subtitle: "Drop in before it fills.", href: wsSlug ? `/workshops/${wsSlug}` : "/workshops" };
    case "workshop_ran_without_you":
      return { title: `${wsTitle} ran without you`, subtitle: "It auto-converted to a live drop-in.", href: wsSlug ? `/workshops/${wsSlug}` : "/workshops" };
    case "workshop_live": {
      const roomId = (n.payload?.room_id as string) || n.entity_id || "";
      const mediumLabel = (n.payload?.medium as string) || null;
      return {
        title: `${actor} is live${mediumLabel ? ` · ${mediumLabel}` : ""}`,
        subtitle: (n.payload?.title as string) || "Drop into their Workshop while there's a seat.",
        href: roomId ? `/workshop/${roomId}` : "/workshop",
      };
    }
    case "payment_failed":
      return { title: "Payment failed", subtitle: "Update your card to keep Plus active.", href: "/me" };
    case "comp_redeemed":
      return { title: "Plus unlocked ✨", subtitle: "Your invite was redeemed.", href: "/me" };
    default:
      return { title: n.kind, subtitle: "", href: "/me" };
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const markAll = useServerFn(markAllNotificationsRead);

  async function load() {
    if (!user) { setItems([]); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, actor_user_id, entity_type, entity_id, payload, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Row[]);
  }

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as Row, ...prev].slice(0, 30)),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (open && items.some((i) => !i.read_at)) {
      markAll({}).catch(() => {});
      setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    }
  }, [open, items, markAll]);

  if (!user) return null;
  const unread = items.filter((i) => !i.read_at).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-border hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-ink">Notifications</span>
          <Link to="/me" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">Dashboard</Link>
        </div>
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-ink-muted">
              Quiet for now.{" "}
              <Link to="/collab" onClick={() => setOpen(false)} className="text-ink underline underline-offset-2 hover:text-primary">
                Post a collab
              </Link>{" "}
              or follow someone to start the loop.
            </li>
          ) : items.map((n) => {
            const { title, subtitle, href } = labelFor(n);
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); navigate({ to: href as any }); }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted/60 ${!n.read_at ? "bg-muted/30" : ""}`}
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink">{title}</span>
                    {subtitle && <span className="block truncate text-xs text-ink-muted">{subtitle}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

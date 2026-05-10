import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Mail, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notif = {
  id: string;
  kind: "incoming_app" | "outgoing_app" | "starting_soon";
  title: string;
  subtitle: string;
  href: string;
  icon: typeof Bell;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) { setItems([]); return; }
    const out: Notif[] = [];

    // 1) Pending applications on workshops I host
    const { data: hosted } = await supabase
      .from("workshops")
      .select("id,title,slug")
      .eq("host_user_id", user.id);
    const hostedIds = (hosted ?? []).map((w: any) => w.id);
    if (hostedIds.length) {
      const { data: apps } = await supabase
        .from("workshop_applications")
        .select("id,workshop_id,status")
        .in("workshop_id", hostedIds)
        .eq("status", "applied")
        .limit(20);
      const byWs = new Map((hosted ?? []).map((w: any) => [w.id, w]));
      for (const a of apps ?? []) {
        const ws: any = byWs.get(a.workshop_id);
        if (!ws) continue;
        out.push({
          id: `app-${a.id}`,
          kind: "incoming_app",
          title: "New application",
          subtitle: ws.title,
          href: `/workshops/${ws.slug}`,
          icon: Mail,
        });
      }
    }

    // 2) Workshops I'm in starting in <60 min
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();
    const { data: parts } = await supabase
      .from("workshop_participants")
      .select("workshop_id, workshops:workshops(id,title,slug,starts_at,status)")
      .eq("user_id", user.id)
      .limit(50);
    for (const p of parts ?? []) {
      const w: any = (p as any).workshops;
      if (!w?.starts_at) continue;
      if (w.starts_at > nowIso && w.starts_at < inOneHour) {
        out.push({
          id: `soon-${w.id}`,
          kind: "starting_soon",
          title: "Starting soon",
          subtitle: w.title,
          href: `/workshops/${w.slug}`,
          icon: Clock,
        });
      }
    }

    setItems(out);
  }

  useEffect(() => { load(); }, [user?.id, open]);

  if (!user) return null;
  const count = items.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-border hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-background">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-ink">Notifications</span>
          <Link to="/me" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">Open dashboard</Link>
        </div>
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-ink-muted">All caught up.</li>
          ) : items.map((n) => {
            const Icon = n.icon;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); navigate({ to: n.href as any }); }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-muted/60"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink">{n.title}</span>
                    <span className="block truncate text-xs text-ink-muted">{n.subtitle}</span>
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

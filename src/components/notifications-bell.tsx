import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Mail, UserPlus, Megaphone, Award } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notif = {
  id: string;
  kind: "collab_invite" | "collab_application" | "work_credit";
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

    // 1) Pending Collab invites where I'm the invitee
    const { data: invites } = await supabase
      .from("collab_invites")
      .select("id,collab_post_id,collab_role_id,post:collab_posts!collab_invites_collab_post_id_fkey(title,slug),role:collab_roles!collab_invites_collab_role_id_fkey(role_name)")
      .eq("invitee_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    for (const inv of (invites ?? []) as any[]) {
      out.push({
        id: `invite-${inv.id}`,
        kind: "collab_invite",
        title: inv.role?.role_name ? `Invited as ${inv.role.role_name}` : "Collab invite",
        subtitle: inv.post?.title ?? "",
        href: `/collab/${inv.post?.slug ?? ""}`,
        icon: UserPlus,
      });
    }

    // 2) Applications on Collabs I own
    const { data: myPosts } = await supabase
      .from("collab_posts")
      .select("id,title,slug")
      .eq("user_id", user.id);
    const postIds = (myPosts ?? []).map((p: any) => p.id);
    if (postIds.length) {
      const byPost = new Map((myPosts ?? []).map((p: any) => [p.id, p]));
      const { data: apps } = await supabase
        .from("collab_contact_events")
        .select("id,collab_post_id,sent_at")
        .in("collab_post_id", postIds)
        .order("sent_at", { ascending: false })
        .limit(20);
      for (const a of (apps ?? []) as any[]) {
        const p: any = byPost.get(a.collab_post_id);
        if (!p) continue;
        out.push({
          id: `app-${a.id}`,
          kind: "collab_application",
          title: "New application",
          subtitle: p.title,
          href: `/collab/${p.slug}`,
          icon: Mail,
        });
      }
    }

    // 3) Recent Work credits where I was credited by someone else
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: creds } = await supabase
      .from("work_credits")
      .select("id,role_label,created_at,work:works!inner(slug,title,created_by)")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const c of (creds ?? []) as any[]) {
      if (!c.work || c.work.created_by === user.id) continue;
      out.push({
        id: `cred-${c.id}`,
        kind: "work_credit",
        title: `You were credited as ${c.role_label}`,
        subtitle: c.work.title,
        href: `/works/${c.work.slug}`,
        icon: Award,
      });
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

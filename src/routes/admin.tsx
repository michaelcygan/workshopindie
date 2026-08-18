import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/login" });
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (error || !data) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; exact?: boolean };
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Home",
    items: [
      { to: "/admin", label: "Pulse", exact: true },
      { to: "/admin/investor", label: "Investor view" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users", label: "Members" },
      { to: "/admin/groups", label: "Groups" },
      { to: "/admin/events", label: "Events" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/admin/traffic", label: "Traffic" },
      { to: "/admin/growth", label: "Growth" },
      { to: "/admin/engagement", label: "Product" },
      { to: "/admin/marketplace", label: "Marketplace" },
      { to: "/admin/geo", label: "Geography" },
      { to: "/admin/revenue", label: "Revenue" },
    ],
  },
  {
    label: "Trust",
    items: [
      { to: "/admin/moderation", label: "Moderation" },
      { to: "/admin/reports", label: "Reports" },
      { to: "/admin/audit", label: "Audit log" },
    ],
  },
  {
    label: "Manage",
    items: [
      { to: "/admin/workshop-events", label: "Workshop Events" },
      { to: "/admin/blog", label: "Blog" },
      { to: "/admin/podcast", label: "Podcast" },
      { to: "/admin/open-house", label: "Open House" },
      { to: "/admin/film-festival", label: "Film Festival" },
      { to: "/admin/blog/subscribers", label: "Email list" },
      { to: "/admin/badges", label: "Badges" },
      { to: "/admin/links", label: "Links" },
      { to: "/admin/resources", label: "Resources" },

      { to: "/admin/plus", label: "Plus grants" },
      { to: "/admin/ops", label: "Flags" },
    ],
  },

];

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink">Admin</h1>
        <p className="text-sm text-ink-muted">Analytics, ops, trust &amp; safety.</p>
      </div>
      <nav className="mb-6 space-y-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-[10px] font-medium uppercase tracking-wider text-ink-muted">{g.label}</span>
            <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
              {g.items.map((n) => (
                <Link
                  key={n.to}
                  to={n.to as any}
                  activeOptions={n.exact ? { exact: true } : undefined}
                  className="rounded-full px-3 py-1 text-sm text-ink-soft hover:bg-background"
                  activeProps={{ className: "rounded-full bg-background px-3 py-1 text-sm font-medium text-ink shadow-sm" }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

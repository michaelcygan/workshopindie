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

const NAV: { to: string; label: string; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/growth", label: "Growth" },
  { to: "/admin/engagement", label: "Engagement" },
  { to: "/admin/marketplace", label: "Marketplace" },
  { to: "/admin/geo", label: "Geo Map" },
  { to: "/admin/revenue", label: "Revenue" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/moderation", label: "Moderation" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/badges", label: "Badges" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/events", label: "Events" },
  
  { to: "/admin/links", label: "Links" },
  { to: "/admin/ops", label: "Ops & Flags" },
  { to: "/admin/audit", label: "Audit Log" },
];

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink">Admin</h1>
        <p className="text-sm text-ink-muted">Analytics, ops, trust &amp; safety.</p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl bg-muted p-1">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to as any}
            activeOptions={n.exact ? { exact: true } : undefined}
            className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-background"
            activeProps={{ className: "rounded-full bg-background px-3 py-1.5 text-sm font-medium text-ink shadow-sm" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

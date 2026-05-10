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

function AdminLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Admin</h1>
          <p className="text-sm text-ink-muted">Trust & safety, content, and badges.</p>
        </div>
        <nav className="flex gap-1 rounded-full bg-muted p-1">
          <Link
            to="/admin"
            activeOptions={{ exact: true }}
            className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-background"
            activeProps={{ className: "rounded-full bg-background px-3 py-1.5 text-sm font-medium text-ink shadow-sm" }}
          >
            Reports
          </Link>
          <Link
            to="/admin/badges"
            className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-background"
            activeProps={{ className: "rounded-full bg-background px-3 py-1.5 text-sm font-medium text-ink shadow-sm" }}
          >
            Badges
          </Link>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  FolderOpen, FileText, ListChecks, Link2, Activity, Scale, ArrowLeft,
} from "lucide-react";
import { getWorkTools } from "@/lib/work-tools.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/works/$slug/tools")({
  component: ToolsLayout,
  beforeLoad: ({ params, location }) => {
    // Redirect bare /tools to /tools/files
    if (location.pathname === `/works/${params.slug}/tools`
        || location.pathname === `/works/${params.slug}/tools/`) {
      throw redirect({ to: "/works/$slug/tools/$tool", params: { slug: params.slug, tool: "files" } });
    }
  },
});

const TOOLS = [
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "notepad", label: "Notepad", icon: FileText },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "links", label: "Links", icon: Link2 },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "rights", label: "Rights", icon: Scale },
] as const;

function ToolsLayout() {
  const { slug } = Route.useParams();
  const fetchTools = useServerFn(getWorkTools);
  const { data, isLoading, error } = useQuery({
    queryKey: ["work-tools", slug],
    queryFn: () => fetchTools({ data: { slug } }),
    retry: false,
  });

  useEffect(() => {
    if (data?.work?.title) {
      document.title = `${data.work.title} — Tools`;
    }
  }, [data?.work?.title]);

  if (isLoading) {
    return <div className="container mx-auto p-8 text-muted-foreground">Loading workspace…</div>;
  }
  if (error) {
    return (
      <div className="container mx-auto p-8 max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Can't open this workspace</h1>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <Button asChild variant="outline"><Link to="/me">Back to your stuff</Link></Button>
      </div>
    );
  }
  if (!data) return null;

  const visibilityLabel =
    data.work.visibility === "public" ? "Open to applicants"
    : data.work.visibility === "invite_only" ? "Invite link only"
    : "Private";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/works/$slug" params={{ slug }}>
              <ArrowLeft className="size-4 mr-1" /> Back to work
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold truncate">{data.work.title}</h1>
              <Badge variant="outline" className="capitalize text-xs">{data.work.category}</Badge>
              <Badge variant="secondary" className="text-xs">{visibilityLabel}</Badge>
              {data.isOwner && <Badge className="text-xs">Owner</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.collaborators.length} collaborator{data.collaborators.length === 1 ? "" : "s"}
              {" · "}{data.fileCount} file{data.fileCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 hidden md:block">
          <nav className="space-y-1">
            {TOOLS.map((t) => (
              <Link
                key={t.key}
                to="/works/$slug/tools/$tool"
                params={{ slug, tool: t.key }}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors [&.active]:bg-accent [&.active]:font-medium"
                activeProps={{ className: "active" }}
              >
                <t.icon className="size-4" />
                {t.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile tab strip */}
        <div className="md:hidden w-full mb-3 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TOOLS.map((t) => (
              <Link
                key={t.key}
                to="/works/$slug/tools/$tool"
                params={{ slug, tool: t.key }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap hover:bg-accent [&.active]:bg-accent [&.active]:font-medium border border-border"
                activeProps={{ className: "active" }}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

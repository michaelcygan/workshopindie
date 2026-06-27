import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Clock, Sparkles, ExternalLink, MapPin, Radio, X, Inbox, Trash2, Archive, FileEdit, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { StateBadge } from "@/components/state-badge";
import { PublishFromCollabSheet } from "@/components/publish-from-collab-sheet";
import {
  closeCollab,
  extendCollabDeadline,
  dismissPublishNudge,
} from "@/lib/collab-publish.functions";
import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/me/collabs")({
  component: MyCollabsPage,
  head: () => ({
    meta: [
      { title: "My Collabs — Workshop" },
      { name: "description", content: "Everything you're hosting or applied to in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Tab = "hosting" | "published" | "applied";

type HostingRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: Category;
  status: string;
  ends_on: string | null;
  closed_at: string | null;
  resulting_work_id: string | null;
  created_at: string;
  live_workshop_id: string | null;
  city: { name: string } | null;
  applicant_count: number;
};


type PublishedRow = {
  id: string;
  title: string;
  category: Category;
  closed_at: string | null;
  work: { slug: string; title: string; cover_url: string | null } | null;
};

type AppliedRow = {
  id: string;
  sent_at: string;
  post: {
    id: string;
    title: string;
    slug: string;
    category: Category;
    status: string;
    resulting_work_id: string | null;
  } | null;
};

function MyCollabsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("hosting");
  const [publishTarget, setPublishTarget] =
    useState<{ id: string; title: string; description: string | null } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const closeFn = useServerFn(closeCollab);
  
  const extendFn = useServerFn(extendCollabDeadline);
  const dismissFn = useServerFn(dismissPublishNudge);

  const today = new Date().toISOString().slice(0, 10);

  // Hosting includes everything the user owns that hasn't shipped a Work yet:
  // open posts AND archived (closed-no-Work) posts — archived shows inline with a muted badge.
  const { data: hosting = [] } = useQuery({
    queryKey: ["my-collabs-hosting", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HostingRow[]> => {
      const { data } = await supabase
        .from("collab_posts")
        .select("id,title,slug,description,category,status,ends_on,closed_at,resulting_work_id,created_at,live_workshop_id,city:cities!collab_posts_city_id_fkey(name)")
        .eq("user_id", user!.id)
        .is("resulting_work_id", null)
        .in("status", ["draft", "open", "closed"])
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as Omit<HostingRow, "applicant_count">[];
      // Applicant counts — small N, one query per post is fine here. Skip drafts.
      const counts = await Promise.all(rows.map(async (r) => {
        if (r.status === "draft") return 0;
        const [{ count: members }, { count: guests }] = await Promise.all([
          supabase.from("collab_contact_events").select("id", { count: "exact", head: true }).eq("collab_post_id", r.id),
          supabase.from("collab_guest_applications").select("id", { count: "exact", head: true }).eq("collab_post_id", r.id).is("matched_user_id", null),
        ]);
        return (members ?? 0) + (guests ?? 0);
      }));
      return rows.map((r, i) => ({ ...r, applicant_count: counts[i] }));
    },
  });


  const { data: published = [] } = useQuery({
    queryKey: ["my-collabs-published", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PublishedRow[]> => {
      const { data } = await supabase
        .from("collab_posts")
        .select("id,title,category,closed_at,resulting_work_id")
        .eq("user_id", user!.id)
        .not("resulting_work_id", "is", null)
        .order("closed_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as { id: string; title: string; category: Category; closed_at: string | null; resulting_work_id: string | null }[];
      const workIds = rows.map((r) => r.resulting_work_id).filter(Boolean) as string[];
      if (workIds.length === 0) return rows.map((r) => ({ ...r, work: null }));
      const { data: works } = await supabase
        .from("works")
        .select("id,slug,title,cover_url")
        .in("id", workIds);
      const map = new Map((works ?? []).map((w) => [w.id, w]));
      return rows.map((r) => {
        const w = r.resulting_work_id ? map.get(r.resulting_work_id) : undefined;
        return { ...r, work: w ? { slug: w.slug, title: w.title, cover_url: w.cover_url } : null };
      });
    },
  });

  const { data: applied = [] } = useQuery({
    queryKey: ["my-collabs-applied", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppliedRow[]> => {
      const { data } = await supabase
        .from("collab_contact_events")
        .select("id,sent_at,collab_post_id,post:collab_posts!collab_contact_events_collab_post_id_fkey(id,title,slug,category,status,resulting_work_id)")
        .eq("sender_user_id", user!.id)
        .order("sent_at", { ascending: false })
        .limit(60);
      // Dedupe by post id (you may apply to multiple roles on the same post).
      const seen = new Set<string>();
      const rows: AppliedRow[] = [];
      for (const r of (data ?? []) as unknown as AppliedRow[]) {
        const pid = r.post?.id;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        rows.push(r);
      }
      return rows;
    },
  });

  const deadlinePassedCount = useMemo(
    () => hosting.filter((r) => r.status === "open" && r.ends_on && r.ends_on < today).length,
    [hosting, today],
  );
  const archivedCount = useMemo(
    () => hosting.filter((r) => r.status === "closed").length,
    [hosting],
  );
  const attentionCount = deadlinePassedCount;

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["my-collabs-hosting"] });
    qc.invalidateQueries({ queryKey: ["my-collabs-published"] });
  }

  const closeMut = useMutation({
    mutationFn: (id: string) => closeFn({ data: { collabPostId: id } }),
    onSuccess: () => { toast.success("Closed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const extendMut = useMutation({
    mutationFn: (v: { id: string; endsOn: string }) => extendFn({ data: { collabPostId: v.id, endsOn: v.endsOn } }),
    onSuccess: () => { toast.success("Deadline extended"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dismissMut = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { collabPostId: id } }),
    onSuccess: () => invalidateAll(),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collab_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) {
    return <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">Loading…</main>;
  }

  const tabs: { id: Tab; label: string; count?: number; emphasize?: boolean }[] = [
    { id: "hosting", label: "Hosting", count: hosting.length, emphasize: deadlinePassedCount > 0 },
    { id: "published", label: "Published", count: published.length },
    { id: "applied", label: "Applied", count: applied.length },
  ];


  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">My Collabs</h1>
          <p className="mt-1 text-ink-muted">
            {attentionCount > 0
              ? `${attentionCount} need${attentionCount === 1 ? "s" : ""} your attention.`
              : "Everything you're hosting or applied to."}
          </p>
        </div>
        <Link to="/collab/new">
          <Button className="rounded-full gap-2">
            <Megaphone className="h-4 w-4" /> Post a Collab
          </Button>
        </Link>
      </motion.div>

      <div className="mt-8 flex flex-wrap gap-1.5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative -mb-px flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id ? "border-b-2 border-ink text-ink" : "border-b-2 border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && t.count > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                t.emphasize ? "bg-amber-500/15 text-amber-700" : "bg-muted text-ink-soft",
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {tab === "hosting" && (
          hosting.length === 0 ? (
            <EmptyState
              title="No Collabs yet."
              body="Post one to find collaborators. Roles, deadline, comp — it takes a minute."
              cta={<Link to="/collab/new"><Button className="rounded-full">Post a Collab</Button></Link>}
            />
          ) : (
            <>
              {archivedCount > 0 && (
                <p className="px-1 text-[11px] text-ink-muted">
                  {archivedCount} archived — only visible to you.
                </p>
              )}
              {hosting.map((r) => {
                const isArchived = r.status === "closed";
                const passed = !isArchived && !!r.ends_on && r.ends_on < today;
                return (
                  <div key={r.id} className={cn(
                    "flex flex-wrap items-center gap-3 rounded-2xl border p-4",
                    isArchived ? "border-dashed border-border bg-surface-2/40" : passed ? "border-amber-500/30 bg-surface" : "border-border bg-surface",
                  )}>
                    <CategoryChip category={r.category} />
                    {isArchived
                      ? <StateBadge tone="closed" label="Closed" sublabel="Archived" />
                      : passed
                        ? <StateBadge tone="open" label="Open" sublabel="Past deadline" />
                        : <StateBadge tone="open" label="Open" sublabel="Casting" />}
                    <div className={cn("min-w-0 flex-1", isArchived && "opacity-70")}>
                      <Link to="/collab/$slug" params={{ slug: r.slug }} className="block truncate font-medium text-ink hover:underline">
                        {r.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        {r.city?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city.name}</span>}
                        {isArchived && r.closed_at && (
                          <span className="inline-flex items-center gap-1"><Archive className="h-3 w-3" /> Archived {new Date(r.closed_at).toLocaleDateString()}</span>
                        )}
                        {!isArchived && r.ends_on && (
                          <span className={cn("inline-flex items-center gap-1", passed && "text-amber-700")}>
                            <Clock className="h-3 w-3" /> {passed ? "Deadline passed" : `Until ${r.ends_on}`}
                          </span>
                        )}
                        {r.applicant_count > 0 && (
                          <span className="inline-flex items-center gap-1"><Inbox className="h-3 w-3" />{r.applicant_count} applicant{r.applicant_count === 1 ? "" : "s"}</span>
                        )}
                        {!isArchived && r.live_workshop_id && (
                          <span className="inline-flex items-center gap-1 text-primary"><Radio className="h-3 w-3" /> Workshop open</span>
                        )}
                      </div>
                    </div>
                    {isArchived ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" className="rounded-full gap-1 text-ink-muted" onClick={() => dismissMut.mutate(r.id)}>
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-full gap-1 text-ink-muted" onClick={() => { if (confirm("Delete this archived collab permanently?")) deleteMut.mutate(r.id); }}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                        <Button size="sm" className="rounded-full gap-1" onClick={() => setPublishTarget({ id: r.id, title: r.title, description: r.description })}>
                          <Sparkles className="h-3.5 w-3.5" /> Publish a Work
                        </Button>
                      </div>
                    ) : passed ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => {
                          const next = prompt("Extend until (YYYY-MM-DD)", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
                          if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) extendMut.mutate({ id: r.id, endsOn: next });
                        }}>Extend</Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => { if (confirm("Close this collab?")) closeMut.mutate(r.id); }}>Close</Button>
                        <Button size="sm" className="rounded-full gap-1" onClick={() => setPublishTarget({ id: r.id, title: r.title, description: r.description })}>
                          <Sparkles className="h-3.5 w-3.5" /> Publish
                        </Button>
                      </div>
                    ) : (
                      <Link to="/collab/$slug" params={{ slug: r.slug }}>
                        <Button size="sm" variant="outline" className="rounded-full">Manage</Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </>
          )
        )}


        {tab === "published" && (
          published.length === 0 ? (
            <EmptyState title="No published Works yet." body="When you publish a Work from a Collab, it shows up here." />
          ) : (
            published.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                {r.work?.cover_url ? (
                  <img src={r.work.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl gradient-motion" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.work?.title ?? r.title}</p>
                  <p className="text-xs text-ink-muted">From your collab “{r.title}”</p>
                </div>
                {r.work && (
                  <Link to="/works/$slug" params={{ slug: r.work.slug }}>
                    <Button size="sm" variant="outline" className="rounded-full gap-1">
                      Open Work <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            ))
          )
        )}

        {tab === "applied" && (
          applied.length === 0 ? (
            <EmptyState
              title="You haven't applied to anything yet."
              body="Browse the Collab Board — apply to a role in one tap."
              cta={<Link to="/collab"><Button className="rounded-full">Browse Collabs</Button></Link>}
            />
          ) : (
            applied.map((r) => r.post && (
              <Link key={r.id} to="/collab/$slug" params={{ slug: r.post.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
                <CategoryChip category={r.post.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.post.title}</p>
                  <p className="text-xs text-ink-muted">Applied {new Date(r.sent_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
                  {r.post.resulting_work_id ? "Published" : r.post.status}
                </span>
              </Link>
            ))
          )
        )}
      </div>

      {publishTarget && (
        <PublishFromCollabSheet
          open={!!publishTarget}
          onOpenChange={(o) => { if (!o) { setPublishTarget(null); invalidateAll(); } }}
          postId={publishTarget.id}
          postTitle={publishTarget.title}
          postDescription={publishTarget.description}
        />
      )}
    </main>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

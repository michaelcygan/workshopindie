import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Clock, Sparkles, ExternalLink, MapPin, Radio, Inbox, Trash2, Archive, ArchiveRestore, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { StateBadge } from "@/components/state-badge";
import { PublishFromCollabSheet } from "@/components/publish-from-collab-sheet";
import {
  setCollabApplicationsOpen,
  setCollabArchived,
  extendCollabDeadline,
} from "@/lib/collab-publish.functions";
import {
  collabLifecycleState,
  recruitmentState,
  recruitmentLabel,
  isLegacyPrivateDraft,
} from "@/lib/collab/lifecycle";
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

type Tab = "in_progress" | "published" | "applied" | "archived";

type HostingRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: Category;
  status: string;
  applications_open: boolean | null;
  archived_at: string | null;
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
    applications_open: boolean | null;
    archived_at: string | null;
    resulting_work_id: string | null;
  } | null;
};

function MyCollabsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("in_progress");
  const [publishTarget, setPublishTarget] =
    useState<{ id: string; title: string; description: string | null } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const pauseFn = useServerFn(setCollabApplicationsOpen);
  const archiveFn = useServerFn(setCollabArchived);
  const extendFn = useServerFn(extendCollabDeadline);

  const today = new Date().toISOString().slice(0, 10);

  // Everything the owner still holds: In Progress and Archived both live here,
  // and are split into tabs by derived lifecycle state.
  const { data: hosting = [] } = useQuery({
    queryKey: ["my-collabs-hosting", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HostingRow[]> => {
      const { data } = await supabase
        .from("collab_posts")
        .select("id,title,slug,description,category,status,applications_open,archived_at,ends_on,closed_at,resulting_work_id,created_at,live_workshop_id,city:cities!collab_posts_city_id_fkey(name)")
        .eq("user_id", user!.id)
        .is("resulting_work_id", null)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as Omit<HostingRow, "applicant_count">[];
      const counts = await Promise.all(rows.map(async (r) => {
        if (isLegacyPrivateDraft(r)) return 0;
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
        .select("id,sent_at,collab_post_id,post:collab_posts!collab_contact_events_collab_post_id_fkey(id,title,slug,category,status,applications_open,archived_at,resulting_work_id)")
        .eq("sender_user_id", user!.id)
        .order("sent_at", { ascending: false })
        .limit(60);
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

  const inProgress = useMemo(
    () => hosting.filter((r) => collabLifecycleState(r) === "in_progress"),
    [hosting],
  );
  const archived = useMemo(
    () => hosting.filter((r) => collabLifecycleState(r) === "archived"),
    [hosting],
  );
  const deadlinePassedCount = useMemo(
    () => inProgress.filter((r) => recruitmentState(r, today) === "deadline_passed").length,
    [inProgress, today],
  );

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["my-collabs-hosting"] });
    qc.invalidateQueries({ queryKey: ["my-collabs-published"] });
  }

  const pauseMut = useMutation({
    mutationFn: (v: { id: string; open: boolean }) => pauseFn({ data: { collabPostId: v.id, open: v.open } }),
    onSuccess: (_d, v) => { toast.success(v.open ? "Accepting collaborators again" : "Submissions paused"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archiveMut = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archiveFn({ data: { collabPostId: v.id, archived: v.archived } }),
    onSuccess: (_d, v) => { toast.success(v.archived ? "Archived" : "Restored"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const extendMut = useMutation({
    mutationFn: (v: { id: string; endsOn: string }) => extendFn({ data: { collabPostId: v.id, endsOn: v.endsOn } }),
    onSuccess: () => { toast.success("Deadline extended"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
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
    { id: "in_progress", label: "In Progress", count: inProgress.length, emphasize: deadlinePassedCount > 0 },
    { id: "applied", label: "Applied", count: applied.length },
    { id: "published", label: "Published", count: published.length },
    { id: "archived", label: "Archived", count: archived.length },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl">My Collabs</h1>
          <p className="mt-1 text-ink-muted">
            {deadlinePassedCount > 0
              ? `${deadlinePassedCount} past its deadline.`
              : "Everything you're making or applied to."}
          </p>
        </div>
        <Link to="/collab/new">
          <Button className="rounded-md gap-2">
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
        {tab === "in_progress" && (
          inProgress.length === 0 ? (
            <EmptyState
              title="Nothing in progress."
              body="Start a Collab to find collaborators. A title is enough to begin."
              cta={<Link to="/collab/new"><Button className="rounded-md">Post a Collab</Button></Link>}
            />
          ) : (
            inProgress.map((r) => {
              const recruit = recruitmentState(r, today);
              const expired = recruit === "deadline_passed";
              const privateDraft = isLegacyPrivateDraft(r);
              return (
                <div key={r.id} className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border p-4",
                  expired ? "border-amber-500/30 bg-surface" : "border-border bg-surface",
                )}>
                  <CategoryChip category={r.category} />
                  <StateBadge
                    tone={recruit === "accepting" ? "open" : "closed"}
                    label="In Progress"
                    sublabel={privateDraft ? "Private — only you" : recruitmentLabel(recruit)}
                  />
                  <div className="min-w-0 flex-1">
                    <Link to="/collab/$slug" params={{ slug: r.slug }} className="block truncate font-medium text-ink hover:underline">
                      {r.title || "Untitled"}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      {r.city?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city.name}</span>}
                      {r.ends_on && (
                        <span className={cn("inline-flex items-center gap-1", expired && "text-amber-700")}>
                          <Clock className="h-3 w-3" /> {expired ? "Deadline passed" : `Until ${r.ends_on}`}
                        </span>
                      )}
                      {r.applicant_count > 0 && (
                        <span className="inline-flex items-center gap-1"><Inbox className="h-3 w-3" />{r.applicant_count} applicant{r.applicant_count === 1 ? "" : "s"}</span>
                      )}
                      {r.live_workshop_id && (
                        <span className="inline-flex items-center gap-1 text-primary"><Radio className="h-3 w-3" /> Live audio open</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {expired && (
                      <Button size="sm" variant="ghost" className="rounded-md" onClick={() => {
                        const next = prompt("Extend until (YYYY-MM-DD)", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
                        if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) extendMut.mutate({ id: r.id, endsOn: next });
                      }}>Extend</Button>
                    )}
                    {recruit === "accepting" ? (
                      <Button size="sm" variant="outline" className="rounded-md" onClick={() => pauseMut.mutate({ id: r.id, open: false })}>
                        Pause submissions
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="rounded-md" onClick={() => pauseMut.mutate({ id: r.id, open: true })}>
                        Accept collaborators
                      </Button>
                    )}
                    <Button size="sm" className="rounded-md gap-1" onClick={() => setPublishTarget({ id: r.id, title: r.title, description: r.description })}>
                      <Sparkles className="h-3.5 w-3.5" /> Publish Work
                    </Button>
                    <Link to="/collab/$slug" params={{ slug: r.slug }}>
                      <Button size="sm" variant="ghost" className="rounded-md gap-1"><Pencil className="h-3.5 w-3.5" /> Manage</Button>
                    </Link>
                  </div>
                </div>
              );
            })
          )
        )}

        {tab === "archived" && (
          archived.length === 0 ? (
            <EmptyState title="Nothing archived." body="Archived Collabs stay private to you. You can restore them any time." />
          ) : (
            archived.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/40 p-4">
                <CategoryChip category={r.category} />
                <StateBadge tone="closed" label="Archived" sublabel="Only you can see this" />
                <div className="min-w-0 flex-1 opacity-70">
                  <Link to="/collab/$slug" params={{ slug: r.slug }} className="block truncate font-medium text-ink hover:underline">
                    {r.title || "Untitled"}
                  </Link>
                  {r.archived_at && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1"><Archive className="h-3 w-3" /> Archived {new Date(r.archived_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" className="rounded-md gap-1 text-ink-muted" onClick={() => { if (confirm("Delete this Collab permanently?")) deleteMut.mutate(r.id); }}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-md gap-1" onClick={() => archiveMut.mutate({ id: r.id, archived: false })}>
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                  </Button>
                </div>
              </div>
            ))
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
                  <div className="h-14 w-14 rounded-xl bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.work?.title ?? r.title}</p>
                  <p className="text-xs text-ink-muted">From your collab “{r.title}”</p>
                </div>
                {r.work && (
                  <Link to="/works/$slug" params={{ slug: r.work.slug }}>
                    <Button size="sm" variant="outline" className="rounded-md gap-1">
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
              cta={<Link to="/collab"><Button className="rounded-md">Browse Collabs</Button></Link>}
            />
          ) : (
            applied.map((r) => r.post && (
              <Link key={r.id} to="/collab/$slug" params={{ slug: r.post.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
                <CategoryChip category={r.post.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.post.title}</p>
                  <p className="text-xs text-ink-muted">Applied {new Date(r.sent_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                  {recruitmentLabel(recruitmentState(r.post, today))}
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
    <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}

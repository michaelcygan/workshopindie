import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Calendar, Users, Sparkles, Pencil, Plus, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CategoryChip } from "@/components/category-chip";
import { PublishFromCollabSheet } from "@/components/publish-from-collab-sheet";
import { dismissPublishNudge } from "@/lib/collab-publish.functions";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/seo";
import { useUserRoles } from "@/hooks/use-user-role";
import type { Category } from "@/lib/categories";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/me/")({
  component: () => <RequireAuth><MeDashboard /></RequireAuth>,
});

type Tab = "hosting" | "applied" | "participating" | "drafts";

function MeDashboard() {
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("drafts");

  useDocumentMeta({ title: "Your dashboard", description: "Manage your Workshops, applications, and drafts." });

  // Onboarding gate
  useEffect(() => {
    if (loading) return;
    if (!user) return void navigate({ to: "/login" });
    supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data?.onboarded) navigate({ to: "/onboarding" });
    });
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["me-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name,username,avatar_url,headline").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: hosting = [] } = useQuery({
    queryKey: ["me-hosting", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("workshops")
        .select("id,title,slug,category,status,starts_at,location_type,location_text,confirmed_count,application_count,participant_cap")
        .eq("host_user_id", user!.id)
        .order("starts_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: applied = [] } = useQuery({
    queryKey: ["me-applied", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_applications")
        .select("id,status,submitted_at,role:workshop_roles(role_name), workshop:workshops!inner(id,title,slug,category,starts_at,location_type,location_text,host_user_id)")
        .eq("user_id", user!.id)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: participating = [] } = useQuery({
    queryKey: ["me-participating", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("workshop_participants")
        .select("id,participant_status,joined_at, workshop:workshops!inner(id,title,slug,category,status,starts_at,ends_at,location_type,location_text,check_in_opens_at,check_in_closes_at)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["me-drafts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id,title,slug,category,cover_url,status,updated_at")
        .eq("created_by", user!.id)
        .neq("status", "published")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });


  const { data: closedNudges = [] } = useQuery({
    queryKey: ["me-closed-collabs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("collab_posts")
        .select("id,title,slug,description")
        .eq("user_id", user!.id)
        .eq("status", "closed")
        .is("resulting_work_id", null)
        .is("close_nudge_dismissed_at", null)
        .order("closed_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (!user) return <main className="mx-auto max-w-3xl px-4 py-20 text-center text-ink-muted">Loading…</main>;

  const name = profile?.display_name || profile?.username || "Creator";
  const counts: Record<Tab, number> = {
    hosting: hosting.length,
    applied: applied.length,
    participating: participating.length,
    drafts: drafts.length,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <motion.header initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-surface p-5 shadow-soft md:gap-5 md:p-6">
        <Avatar className="h-14 w-14 md:h-16 md:w-16">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-lg">{name[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl text-ink md:text-3xl">Welcome back, {name.split(" ")[0]}</h1>
          </div>
          {profile?.headline && <p className="text-sm text-ink-muted">{profile.headline}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {profile?.username && (
            <Link to="/u/$username" params={{ username: profile.username }}>
              <Button variant="outline" className="rounded-full gap-1.5"><ExternalLink className="h-4 w-4" /> Public profile</Button>
            </Link>
          )}
          <Link to="/me/edit"><Button variant="ghost" className="rounded-full gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button></Link>
        </div>
      </motion.header>

      {closedNudges.length > 0 && (
        <ClosedCollabNudges items={closedNudges as { id: string; title: string; slug: string; description: string | null }[]} />
      )}

      {(() => {
        const hasWorkshopHistory = counts.hosting + counts.applied + counts.participating > 0;
        const tabs: Tab[] = (isAdmin || hasWorkshopHistory)
          ? ["hosting", "applied", "participating", "drafts"]
          : ["drafts"];
        return (
          <div className="mt-8 flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1 shadow-soft w-fit">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("rounded-full px-3.5 py-1.5 text-sm capitalize transition",
                  tab === t ? "bg-ink text-background" : "text-ink-soft hover:bg-muted")}>
                {t} <span className="ml-1 text-[11px] opacity-70">{counts[t]}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <div className="mt-6">
        {tab === "hosting" && <HostingList items={hosting as any} />}
        {tab === "applied" && <AppliedList items={applied as any} />}
        {tab === "participating" && <ParticipatingList items={participating as any} />}
        {tab === "drafts" && <DraftsList items={drafts as any} />}
      </div>

      <p className="mt-10 text-center text-xs text-ink-muted">
        Your portfolio, credits, collabs, workshops, and groups live on your public profile.
        {profile?.username && (
          <> <Link to="/u/$username" params={{ username: profile.username }} className="underline">View it →</Link></>
        )}
      </p>
    </main>
  );
}

function EmptyState({ title, body, ctaLabel, ctaTo }: { title: string; body: string; ctaLabel: string; ctaTo: "/instant" | "/works/new" | "/collab" | "/collab/new" }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-10 text-center">
      <span className="gradient-motion mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
      <h3 className="mt-2 font-display text-2xl text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      <Link to={ctaTo} className="mt-5 inline-block"><Button className="rounded-full">{ctaLabel}</Button></Link>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">{status.replace("_", " ")}</span>;
}

function whenText(starts: string | null) {
  if (!starts) return "Time TBD";
  const d = new Date(starts);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type WSRow = { id: string; title: string; slug: string; category: Category; status: string; starts_at: string | null; location_type: string; location_text: string | null; confirmed_count: number; application_count: number; participant_cap: number | null };

function HostingList({ items }: { items: WSRow[] }) {
  if (items.length === 0) return <EmptyState title="No Collabs posted yet." body="Post a Collab to find collaborators and start building." ctaLabel="Post a Collab" ctaTo="/collab" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((w) => (
        <Link key={w.id} to="/workshops/$slug" params={{ slug: w.slug }} className="rounded-2xl border border-border bg-surface p-4 transition hover:shadow-soft">
          <div className="flex items-center gap-2">
            <CategoryChip category={w.category} />
            <StatusPill status={w.status} />
          </div>
          <h3 className="mt-2 font-display text-lg text-ink line-clamp-2">{w.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {whenText(w.starts_at)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {w.confirmed_count}{w.participant_cap ? `/${w.participant_cap}` : ""} · {w.application_count} apps</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AppliedList({ items }: { items: { id: string; status: string; submitted_at: string; role: { role_name: string } | null; workshop: WSRow }[] }) {
  if (items.length === 0) return <EmptyState title="No applications yet." body="Browse open collabs and pitch on a role." ctaLabel="Browse Collabs" ctaTo="/collab" />;
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <Link key={a.id} to="/workshops/$slug" params={{ slug: a.workshop.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
          <CategoryChip category={a.workshop.category} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-ink">{a.workshop.title}</h3>
            <p className="text-xs text-ink-muted">{a.role?.role_name ? `for ${a.role.role_name} · ` : ""}{whenText(a.workshop.starts_at)}</p>
          </div>
          <StatusPill status={a.status} />
        </Link>
      ))}
    </div>
  );
}

function ParticipatingList({ items }: { items: { id: string; participant_status: string; workshop: WSRow & { ends_at: string | null; check_in_opens_at: string | null; check_in_closes_at: string | null } }[] }) {
  if (items.length === 0) return <EmptyState title="No active rooms." body="Drop into a live Workshop — when you're in one, it shows up here." ctaLabel="Drop into a Workshop" ctaTo="/instant" />;
  const now = Date.now();
  return (
    <div className="space-y-2">
      {items.map((p) => {
        const w = p.workshop;
        const ciOpen = w.check_in_opens_at && w.check_in_closes_at &&
          now >= new Date(w.check_in_opens_at).getTime() && now <= new Date(w.check_in_closes_at).getTime();
        return (
          <Link key={p.id} to="/workshops/$slug" params={{ slug: w.slug }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
            <CategoryChip category={w.category} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-medium text-ink">{w.title}</h3>
              <p className="text-xs text-ink-muted">{whenText(w.starts_at)}</p>
            </div>
            {ciOpen && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Check in now</span>}
            <StatusPill status={p.participant_status} />
          </Link>
        );
      })}
    </div>
  );
}

function DraftsList({ items }: { items: { id: string; title: string; slug: string; category: Category; cover_url: string | null; status: string; updated_at: string }[] }) {
  if (items.length === 0) return <EmptyState title="No drafts." body="Unfinished Works land here while you're still cooking." ctaLabel="Publish a Work" ctaTo="/works/new" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((w) => (
        <Link key={w.id} to="/works/$slug" params={{ slug: w.slug }} className="flex gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-soft">
          {w.cover_url ? (
            <img src={w.cover_url} className="h-16 w-16 rounded-xl object-cover" alt="" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-surface-2" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5"><CategoryChip category={w.category} /><StatusPill status={w.status} /></div>
            <h3 className="mt-1 truncate font-medium text-ink">{w.title}</h3>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CreditsList({ items, onChange }: { items: { id: string; role_label: string; hidden_from_profile: boolean; work: { id: string; title: string; slug: string; category: Category; cover_url: string | null; status: string; visibility: string; published_at: string | null } }[]; onChange: () => void }) {
  if (items.length === 0) return <EmptyState title="No credits yet." body="Publish a Work to start your portfolio." ctaLabel="Publish a Work" ctaTo="/works/new" />;
  async function toggleHide(id: string, next: boolean) {
    const { error } = await supabase.from("work_credits").update({ hidden_from_profile: next }).eq("id", id);
    if (!error) onChange();
  }
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          {c.work.cover_url ? <img src={c.work.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl bg-surface-2" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link to="/works/$slug" params={{ slug: c.work.slug }} className="truncate font-medium text-ink hover:underline">{c.work.title}</Link>
              <StatusPill status={c.work.status} />
            </div>
            <p className="text-xs text-ink-muted">Credit: {c.role_label}</p>
          </div>
          <button
            type="button"
            onClick={() => toggleHide(c.id, !c.hidden_from_profile)}
            className={cn("rounded-full border px-3 py-1.5 text-xs transition",
              c.hidden_from_profile ? "border-border bg-surface text-ink-soft hover:bg-muted" : "border-transparent bg-ink text-background hover:opacity-90")}
          >
            {c.hidden_from_profile ? "Hidden from profile" : "Shown on profile"}
          </button>
        </div>
      ))}
    </div>
  );
}

function ClosedCollabNudges({ items }: { items: { id: string; title: string; slug: string; description: string | null }[] }) {
  const qc = useQueryClient();
  const dismissFn = useServerFn(dismissPublishNudge);
  const [active, setActive] = useState<{ id: string; title: string; description: string | null } | null>(null);

  async function dismiss(id: string) {
    try {
      await dismissFn({ data: { collabPostId: id } });
      qc.invalidateQueries({ queryKey: ["me-closed-collabs"] });
    } catch (e) { /* silent */ }
  }

  return (
    <section className="mt-6 space-y-2">
      {items.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">Wrap up: {c.title}</p>
            <p className="text-xs text-ink-muted">Publish the Work that came out of this collab — 3 taps.</p>
          </div>
          <Button size="sm" variant="ghost" className="rounded-full text-ink-muted" onClick={() => dismiss(c.id)}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="sm" className="rounded-full gap-1" onClick={() => setActive({ id: c.id, title: c.title, description: c.description })}>
            <Sparkles className="h-3.5 w-3.5" /> Publish Work
          </Button>
        </div>
      ))}
      {active && (
        <PublishFromCollabSheet
          open={!!active}
          onOpenChange={(o) => { if (!o) { setActive(null); qc.invalidateQueries({ queryKey: ["me-closed-collabs"] }); } }}
          postId={active.id}
          postTitle={active.title}
          postDescription={active.description}
        />
      )}
    </section>
  );
}

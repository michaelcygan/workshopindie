import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapPin, Megaphone, Plus, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CategoryChip } from "@/components/category-chip";
import { CreatorBadge } from "@/components/creator-badge";
import { WorkCard, type WorkCardData } from "@/components/work-card";
import { CollabCard, type CollabCardData } from "@/components/collab-card";
import { CategoryScroller } from "@/components/category-scroller";
import { CATEGORIES, WORK_CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/cities/$slug")({ component: CityPage });

function CityPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showMeetupForm, setShowMeetupForm] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<Category | "all">("all");

  const { data: city, isLoading } = useQuery({
    queryKey: ["city", slug],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id,name,country,state_region,slug").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  useDocumentMeta({
    title: city?.name,
    description: city ? `Open collabs, standing meetups, and creators in ${city.name}.` : undefined,
  });

  const { data: meetups = [] } = useQuery({
    queryKey: ["city-meetups", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("standing_meetups")
        .select("id,title,description,default_category,default_location_text,recurrence_rule,status, host:profiles!standing_meetups_host_user_id_fkey(display_name,username,avatar_url)")
        .eq("city_id", city!.id).eq("status", "active").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: works = [] } = useQuery({
    queryKey: ["city-works", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("works")
        .select("id,title,slug,category,cover_url,source_type,like_count,save_count,view_count,published_at, work_credits(role_label,sort_order, profiles(id,display_name,username))")
        .eq("city_id", city!.id).eq("status", "published").in("visibility", ["public", "unlisted"])
        .order("published_at", { ascending: false, nullsFirst: false }).limit(6);
      return ((data ?? []) as any[]).map<WorkCardData>((r) => ({
        id: r.id, title: r.title, slug: r.slug, category: r.category, cover_url: r.cover_url, source_type: r.source_type,
        like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
        credits: (r.work_credits ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((c: any) => ({ id: c.profiles?.id ?? null, display_name: c.profiles?.display_name ?? null, username: c.profiles?.username ?? null })),
      }));
    },
  });

  const { data: collabs = [] } = useQuery({
    queryKey: ["city-collabs", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      // city_id match OR also_cities array contains this city
      const { data } = await supabase.from("collab_posts")
        .select("id,title,slug,category,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at, user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url), city:cities!collab_posts_city_id_fkey(name), roles:collab_roles(id,role_name,sort_order)")
        .or(`city_id.eq.${city!.id},also_cities.cs.{${city!.id}}`)
        .eq("status", "open")
        .order("created_at", { ascending: false }).limit(6);
      return (data ?? []) as unknown as CollabCardData[];
    },
  });

  const { data: creators = [] } = useQuery({
    queryKey: ["city-creators", city?.id],
    enabled: !!city?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id,username,display_name,avatar_url,headline,creator_status,work_count,categories")
        .eq("city_id", city!.id).order("work_count", { ascending: false }).limit(48);
      return data ?? [];
    },
  });

  const filteredCreators = useMemo(() => {
    if (creatorFilter === "all") return creators;
    return (creators as any[]).filter((p) => Array.isArray(p.categories) && p.categories.includes(creatorFilter));
  }, [creators, creatorFilter]);

  const creatorTabs = useMemo(
    () => [{ id: "all" as const, label: "All" }, ...WORK_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))],
    []
  );

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-14"><div className="h-32 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!city) return (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl text-ink">City not found</h1>
      <Link to="/cities" className="mt-4 inline-block text-gradient-motion underline">Back to cities</Link>
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link to="/cities" className="text-sm text-ink-muted hover:text-ink">← All cities</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-ink md:text-5xl inline-flex items-center gap-2">
            <span className="gradient-motion inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground"><MapPin className="h-6 w-6" /></span> {city.name}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{city.state_region ? `${city.state_region}, ` : ""}{city.country}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" className="rounded-full gap-1.5">
            <Link to="/collab/new">
              <Megaphone className="h-4 w-4" /> Post a collab
            </Link>
          </Button>
          {user && (
            <Button className="rounded-full gap-1.5" onClick={() => setShowMeetupForm((v) => !v)}>
              {showMeetupForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showMeetupForm ? "Cancel" : "Start a standing meetup"}
            </Button>
          )}
        </div>
      </div>

      {showMeetupForm && user && (
        <NewMeetupForm cityId={city.id} onDone={() => {
          setShowMeetupForm(false);
          qc.invalidateQueries({ queryKey: ["city-meetups", city.id] });
        }} />
      )}

      {/* Open to collaborate — hero block */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink inline-flex items-center gap-2">
              <span className="gradient-motion inline-flex h-7 w-7 items-center justify-center rounded-full text-primary-foreground"><Sparkles className="h-4 w-4" /></span> Open to collaborate
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Live calls from people who want to make something in {city.name}.</p>
          </div>
          {collabs.length > 0 && (
            <Link to="/collab" className="text-sm text-ink-muted hover:text-ink">See all →</Link>
          )}
        </div>
        {collabs.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
            <p className="text-sm text-ink-muted">No open calls in {city.name} yet — be the first to start something.</p>
            <Button asChild className="mt-4 rounded-full gap-1.5">
              <Link to="/collab/new"><Megaphone className="h-4 w-4" /> Post the first collab here</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collabs.map((c) => <CollabCard key={c.id} post={c} />)}
          </div>
        )}
      </section>

      {/* Standing meetups */}
      <section className="mt-10">
        <h2 className="font-display text-2xl text-ink">Standing meetups</h2>
        {meetups.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
            No standing meetups yet. {user ? "Start the first one above." : <Link to="/login" className="text-gradient-motion underline">Sign in</Link>} to host one.
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {meetups.map((m: any) => (
              <div key={m.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  {m.default_category && <CategoryChip category={m.default_category as Category} />}
                  {m.recurrence_rule && <span className="text-xs text-ink-muted">{m.recurrence_rule}</span>}
                </div>
                <h3 className="mt-2 font-display text-lg text-ink">{m.title}</h3>
                {m.description && <p className="mt-1 text-sm text-ink-soft line-clamp-2">{m.description}</p>}
                {m.default_location_text && <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3 w-3" /> {m.default_location_text}</p>}
                {m.host && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                    <Avatar className="h-5 w-5"><AvatarImage src={m.host.avatar_url ?? undefined} /><AvatarFallback className="text-[9px]">{(m.host.display_name || m.host.username || "·")[0]}</AvatarFallback></Avatar>
                    Hosted by {m.host.display_name || m.host.username}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently made here */}
      {works.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl text-ink">Recently made here</h2>
            <Link to="/gallery" search={{ city: city.slug } as any} className="text-sm text-ink-muted hover:text-ink">See all in {city.name} →</Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((w) => <WorkCard key={w.id} work={w} />)}
          </div>
        </section>
      )}

      {/* Creators */}
      {creators.length > 0 && (
        <section className="mt-10 pb-16">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-2xl text-ink">Local creators</h2>
            <CategoryScroller
              tabs={creatorTabs}
              value={creatorFilter}
              onChange={(v) => setCreatorFilter(v)}
              className="md:w-fit"
            />
          </div>
          {filteredCreators.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No creators here working in this medium yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((p: any) => {
                const inner = (
                  <>
                    <Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{(p.display_name || p.username || "·")[0]}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate font-medium text-ink">{p.display_name || p.username || "Anon"}</h3>
                        <CreatorBadge status={p.creator_status} />
                      </div>
                      {p.headline && <p className="truncate text-xs text-ink-muted">{p.headline}</p>}
                    </div>
                    <span className="text-xs text-ink-muted">{p.work_count} work{p.work_count === 1 ? "" : "s"}</span>
                  </>
                );
                const base = "flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition";
                if (p.username) {
                  return (
                    <Link key={p.id} to="/u/$username" params={{ username: p.username }}
                      className={cn(base, "hover:shadow-soft")}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={p.id} className={base}>{inner}</div>;
              })}
            </div>
          )}
        </section>
      )}

      {/* Workshops coming soon footer */}
      <p className="pb-16 text-center text-xs text-ink-muted">
        Scheduled workshops are coming soon. In the meantime, start a standing meetup or post a collab to spark something in {city.name}.
      </p>
    </main>
  );
}

function NewMeetupForm({ cityId, onDone }: { cityId: string; onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [recurrence, setRecurrence] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("standing_meetups").insert({
      city_id: cityId, host_user_id: user.id,
      title: title.trim(), description: description || null,
      default_category: category || null, recurrence_rule: recurrence || null,
      default_location_text: location || null, status: "active",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Meetup created");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <Label htmlFor="m-title">Title</Label>
        <Input id="m-title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thursday Workshop Night" />
      </div>
      <div>
        <Label>Category (optional)</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategory(category === c.id ? "" : c.id)}
              className={cn("rounded-full border px-3 py-1 text-xs transition",
                category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="m-rec">Recurrence</Label>
          <Input id="m-rec" maxLength={120} value={recurrence} onChange={(e) => setRecurrence(e.target.value)} placeholder="Every Thursday, 6–9pm" />
        </div>
        <div>
          <Label htmlFor="m-loc">Default location</Label>
          <Input id="m-loc" maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Coffee shop, library, art space…" />
        </div>
      </div>
      <div>
        <Label htmlFor="m-desc">Description</Label>
        <Textarea id="m-desc" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happens at this meetup?" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting} className="rounded-full">{submitting ? "Creating…" : "Create meetup"}</Button>
      </div>
    </form>
  );
}

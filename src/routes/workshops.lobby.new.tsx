import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Search, Sparkles, Users, Lock, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import {
  createLobby,
  listMutualFollows,
  listFollowingForLobby,
  type LobbyPerson,
} from "@/lib/lobby.functions";

export const Route = createFileRoute("/workshops/lobby/new")({
  head: () => ({
    meta: [
      { title: "Start a Lobby — invite the people you mutually follow" },
      { name: "description", content: "Spin up a private Workshop lobby for an idea and pull in the people you mutually follow." },
    ],
  }),
  component: NewLobbyPage,
});

function NewLobbyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [discoverable, setDiscoverable] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, LobbyPerson>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const fetchMutuals = useServerFn(listMutualFollows);
  const fetchFollowing = useServerFn(listFollowingForLobby);
  const createFn = useServerFn(createLobby);

  const { data: mutuals = [] } = useQuery({
    queryKey: ["lobby-mutuals"],
    queryFn: () => fetchMutuals({ data: {} }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: extras = [] } = useQuery({
    queryKey: ["lobby-following-search", search],
    queryFn: () => fetchFollowing({ data: { q: search } }),
    enabled: !!user && search.trim().length > 1,
    staleTime: 30_000,
  });

  const visible: LobbyPerson[] = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? mutuals.filter((m) => (m.display_name ?? "").toLowerCase().includes(term) || (m.username ?? "").toLowerCase().includes(term))
      : mutuals;
    if (!term || extras.length === 0) return filtered;
    const seen = new Set(filtered.map((m) => m.user_id));
    return [...filtered, ...extras.filter((e) => !seen.has(e.user_id))];
  }, [mutuals, extras, search]);

  function toggle(p: LobbyPerson) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.user_id)) next.delete(p.user_id);
      else next.set(p.user_id, p);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Give the lobby a title");
    if (title.trim().length < 2) return toast.error("Title is too short");
    setSubmitting(true);
    try {
      const res = await createFn({
        data: {
          title: title.trim(),
          prompt: prompt.trim() || null,
          category,
          discoverable,
          inviteeIds: Array.from(selected.keys()),
        },
      });
      toast.success(selected.size > 0 ? `Lobby started — ${selected.size} invited` : "Lobby started");
      navigate({ to: "/workshops/$slug", params: { slug: res.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start lobby");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-2xl p-10"><div className="h-40 animate-pulse rounded-3xl bg-surface-2" /></main>;

  const selectedList = Array.from(selected.values());

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-soft">
          <Sparkles className="h-3.5 w-3.5" /> New: invite-only lobby
        </div>
        <h1 className="mt-3 font-display text-4xl text-ink">Start a Lobby</h1>
        <p className="mt-2 text-ink-muted">
          A private Workshop for an idea. Pull in people you mutually follow —
          brainstorm, then turn it into a real Workshop when you're ready.
        </p>
      </motion.div>

      <form onSubmit={submit} className="mt-8 space-y-7">
        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A loose idea worth chewing on" />
        </section>

        <section className="space-y-2">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} onClick={() => setCategory(c.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="prompt">What's the idea? <span className="text-ink-muted">(optional)</span></Label>
          <Textarea id="prompt" rows={4} maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="A sentence or two. You can refine it together inside the lobby." />
        </section>

        <section className="space-y-2">
          <Label>Visibility</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setDiscoverable(false)}
              className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition",
                !discoverable ? "border-ink bg-surface" : "border-border bg-surface hover:bg-muted")}>
              <Lock className="mt-0.5 h-4 w-4 text-ink-soft" />
              <div>
                <div className="text-sm font-medium text-ink">Fully private</div>
                <div className="text-xs text-ink-muted">Only people you invite can see it.</div>
              </div>
            </button>
            <button type="button" onClick={() => setDiscoverable(true)}
              className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition",
                discoverable ? "border-ink bg-surface" : "border-border bg-surface hover:bg-muted")}>
              <Eye className="mt-0.5 h-4 w-4 text-ink-soft" />
              <div>
                <div className="text-sm font-medium text-ink">Visible to mutuals</div>
                <div className="text-xs text-ink-muted">People you mutually follow can find it and ask to join.</div>
              </div>
            </button>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-end justify-between">
            <Label>Invite <span className="text-ink-muted">({selected.size} selected)</span></Label>
            <span className="text-xs text-ink-muted">Mutuals first. Search to invite anyone you follow.</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input className="pl-9" placeholder="Search by name or @username" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedList.map((p) => (
                <button type="button" key={p.user_id} onClick={() => toggle(p)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-xs text-background hover:bg-ink/90">
                  {p.display_name ?? p.username ?? "Someone"} ×
                </button>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface">
            {visible.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-muted">
                {search.trim().length > 1
                  ? "No matches in your follows."
                  : mutuals.length === 0
                    ? "No mutual follows yet. Search to invite anyone you follow."
                    : "Mutual follows will appear here."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((p) => {
                  const on = selected.has(p.user_id);
                  return (
                    <li key={p.user_id}>
                      <button type="button" onClick={() => toggle(p)}
                        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted", on && "bg-muted/60")}>
                        <div className="h-8 w-8 overflow-hidden rounded-full bg-surface-2">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-ink">{p.display_name ?? p.username ?? "Someone"}</div>
                          <div className="truncate text-xs text-ink-muted">
                            {p.username ? `@${p.username}` : ""}{p.is_mutual ? <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Mutual</span> : null}
                          </div>
                        </div>
                        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full border", on ? "border-ink bg-ink text-background" : "border-border bg-background text-ink-muted")}>
                          {on ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link to="/workshops"><Button type="button" variant="ghost" className="rounded-full">Cancel</Button></Link>
          <Button type="submit" disabled={submitting} className="rounded-full">
            {submitting ? "Starting…" : selected.size > 0 ? `Start lobby + invite ${selected.size}` : "Start lobby"}
          </Button>
        </div>
      </form>
    </main>
  );
}

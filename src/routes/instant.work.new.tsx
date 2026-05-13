import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Hammer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/instant/work/new")({
  component: SpawnLobby,
  head: () => ({
    meta: [
      { title: "Spawn a Work lobby — Instant" },
    ],
  }),
});

const DURATIONS = [
  { id: "2h", label: "2 hours", hours: 2 },
  { id: "6h", label: "6 hours", hours: 6 },
  { id: "today", label: "End of today", hours: 0 },
  { id: "24h", label: "24 hours", hours: 24 },
] as const;

function SpawnLobby() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [medium, setMedium] = useState<Category | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["id"]>("6h");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  function endsAtFor(id: typeof duration): string {
    const now = new Date();
    if (id === "today") {
      const eod = new Date(now);
      eod.setHours(23, 59, 0, 0);
      if (eod <= now) eod.setDate(eod.getDate() + 1);
      return eod.toISOString();
    }
    const def = DURATIONS.find((d) => d.id === id)!;
    return new Date(now.getTime() + def.hours * 3600_000).toISOString();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !medium || !prompt.trim()) return;
    setSubmitting(true);
    const cleanPrompt = prompt.trim().slice(0, 140);
    const { data, error } = await supabase
      .from("instant_rooms")
      .insert({
        kind: "work",
        title: cleanPrompt,
        prompt: cleanPrompt,
        medium,
        ends_at: endsAtFor(duration),
        creator_id: user.id,
        participant_cap: 6,
      })
      .select("id")
      .single();
    if (error || !data) {
      setSubmitting(false);
      toast.error(error?.message ?? "Couldn't spawn lobby");
      return;
    }
    // Auto-add creator to presence
    await supabase.from("instant_presence").upsert({
      room_id: data.id, user_id: user.id, status: "active", last_seen_at: new Date().toISOString(),
    });
    router.navigate({ to: "/instant/work/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/instant/work" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Work
      </Link>

      <h1 className="mt-3 font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
        <Hammer className="h-6 w-6" /> Spawn a Work lobby
      </h1>
      <p className="mt-1 text-sm text-ink-muted">Three things. Then drop in.</p>

      <form onSubmit={submit} className="mt-8 space-y-7 rounded-3xl border border-border bg-surface p-5 md:p-7 shadow-soft">
        <div>
          <Label className="text-xs uppercase tracking-wide text-ink-muted">Medium</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setMedium(c.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition border",
                  medium === c.id
                    ? cn(categoryClass(c.id), "border-transparent shadow-soft")
                    : "border-border bg-background text-ink-soft hover:bg-muted",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="prompt" className="text-xs uppercase tracking-wide text-ink-muted">Prompt</Label>
          <Input
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Making a track, uploading to SoundCloud by midnight"
            maxLength={140}
            className="mt-2 text-base"
          />
          <p className="mt-1 text-[11px] text-ink-muted">{prompt.length}/140 · One line. What are you making, and what does done look like?</p>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-ink-muted">Ends in</Label>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => setDuration(d.id)}
                className={cn(
                  "rounded-full px-3 py-2 text-sm border transition",
                  duration === d.id ? "border-transparent bg-ink text-background" : "border-border bg-background text-ink-soft hover:bg-muted",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!medium || !prompt.trim() || submitting} size="lg" className="rounded-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
            {submitting ? "Spawning…" : "Spawn lobby"}
          </Button>
        </div>
      </form>
    </main>
  );
}

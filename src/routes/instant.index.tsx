import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Coffee, Hammer, Users, Radio, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/instant/")({
  component: InstantChooser,
  head: () => ({
    meta: [
      { title: "Instant — Drop in or make something" },
      { name: "description", content: "Hang out in the Artist's Lounge or spin up a Work lobby and make something now." },
    ],
  }),
});

function InstantChooser() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: stats } = useQuery({
    queryKey: ["instant-chooser-stats"],
    queryFn: async () => {
      const [loungeRoom, workRooms] = await Promise.all([
        supabase.from("instant_rooms").select("id").eq("slug", "lounge").maybeSingle(),
        supabase.from("instant_rooms").select("id,ends_at").eq("kind", "work"),
      ]);
      const now = new Date();
      const liveWork = (workRooms.data ?? []).filter((r) => !r.ends_at || new Date(r.ends_at) > now);
      let loungeCount = 0;
      if (loungeRoom.data?.id) {
        const { count } = await supabase
          .from("instant_presence")
          .select("user_id", { count: "exact", head: true })
          .eq("room_id", loungeRoom.data.id);
        loungeCount = count ?? 0;
      }
      return { loungeCount, workCount: liveWork.length };
    },
    refetchInterval: 30_000,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-16">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink md:text-6xl flex items-center gap-3">
          Instant
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        </h1>
        <p className="mt-2 text-lg text-ink-muted">What do you want to do right now?</p>
      </motion.div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <ChoiceCard
          to="/instant/lounge"
          icon={Coffee}
          title="Artist's Lounge"
          subtitle="Hang, talk, meet"
          body="One always-on room. Talk shop, find your people, see who's around."
          stat={stats ? `${stats.loungeCount} ${stats.loungeCount === 1 ? "person" : "people"} around` : "—"}
          accent="lounge"
        />
        <ChoiceCard
          to="/instant/work"
          icon={Hammer}
          title="Work"
          subtitle="Make something now"
          body="Spin up a task-based lobby. Bring a prompt, set a deadline, ship by then."
          stat={stats ? `${stats.workCount} ${stats.workCount === 1 ? "lobby" : "lobbies"} live` : "—"}
          accent="work"
        />
      </div>

      <div className="mt-8 text-xs text-ink-muted text-center">
        Looking to plan ahead? <Link to="/workshops" className="text-primary hover:underline">Scheduled Workshops</Link> · <Link to="/collab" className="text-primary hover:underline">Collab Board</Link>
      </div>
    </main>
  );
}

function ChoiceCard({
  to, icon: Icon, title, subtitle, body, stat, accent,
}: {
  to: "/instant/lounge" | "/instant/work";
  icon: typeof Coffee;
  title: string;
  subtitle: string;
  body: string;
  stat: string;
  accent: "lounge" | "work";
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-7 shadow-soft transition hover:shadow-lift hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accent === "lounge" ? "bg-primary/10 text-primary" : "bg-ink text-background"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-ink-soft">
          {accent === "lounge" ? <Users className="h-3 w-3" /> : <Radio className="h-3 w-3 text-primary" />} {stat}
        </span>
      </div>
      <h2 className="mt-5 font-display text-3xl text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      <p className="mt-4 text-sm text-ink-soft leading-relaxed">{body}</p>
      <div className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary group-hover:gap-2.5 transition-all">
        Open <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";

export const Route = createFileRoute("/instant/lounge")({
  component: LoungePage,
  head: () => ({
    meta: [
      { title: "Artist's Lounge — Instant" },
      { name: "description", content: "Always-on hangout for artists. Drop in, talk shop, find your people." },
    ],
  }),
});

function LoungePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room } = useQuery({
    queryKey: ["instant-lounge-room"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms").select("id,title,description").eq("slug", "lounge").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/instant" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Instant
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
            <Coffee className="h-6 w-6 text-primary" /> Artist's Lounge
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Hang out, talk shop, find your people.</p>
        </div>
      </div>

      {room ? (
        <ChannelView key={room.id} roomId={room.id} title={room.title} />
      ) : (
        <div className="mt-6 h-[60vh] animate-pulse rounded-3xl bg-surface-2" />
      )}
    </main>
  );
}

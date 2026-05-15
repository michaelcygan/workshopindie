import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coffee } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";

const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });

export const Route = createFileRoute("/instant/$id")({
  component: LoungeRoomPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Artist's Lounge — Instant" },
      { name: "description", content: "A live Artist's Lounge. Drop in, talk shop, find your people." },
    ],
  }),
});

function LoungeRoomPage() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  // Index this room among active lounges to give it a sequential "Lounge 03" label.
  const { data: room } = useQuery({
    queryKey: ["instant-lounge-room", id],
    queryFn: async () => {
      const [meRow, allRows] = await Promise.all([
        supabase.from("instant_rooms").select("id,title,kind,status,created_at").eq("id", id).maybeSingle(),
        supabase.from("instant_rooms").select("id,created_at").eq("kind", "lounge").eq("status", "active").order("created_at", { ascending: true }),
      ]);
      const idx = (allRows.data ?? []).findIndex((r) => r.id === id);
      const label = idx >= 0 ? `Lounge ${String(idx + 1).padStart(2, "0")}` : "Artist's Lounge";
      return { ...meRow.data, label } as { id: string; title: string; kind: string; status: string; label: string };
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
            <Coffee className="h-6 w-6 text-primary" /> {room?.label ?? "Artist's Lounge"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Live room · up to 5 artists.</p>
        </div>
      </div>

      {room?.id ? (
        <ChannelView key={room.id} roomId={room.id} title={room.label} initialMode={mode ?? "voice"} />
      ) : (
        <div className="mt-6 h-[60vh] animate-pulse rounded-3xl bg-surface-2" />
      )}
    </main>
  );
}

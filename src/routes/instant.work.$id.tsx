import { createFileRoute, Link, useRouter, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, Hammer, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instant/work/$id")({
  component: WorkLobby,
});

function WorkLobby() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  const { data: room, isLoading } = useQuery({
    queryKey: ["instant-work-room", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("id,kind,title,prompt,medium,ends_at,participant_cap, creator:profiles!instant_rooms_creator_id_fkey(display_name,username)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-10"><div className="h-[60vh] animate-pulse rounded-3xl bg-surface-2" /></main>;
  }
  if (!room || room.kind !== "work") {
    return <Navigate to="/instant/work" replace />;
  }

  const ends = room.ends_at ? new Date(room.ends_at) : null;
  const expired = ends && ends <= new Date();
  if (expired) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink">This lobby has wrapped.</h1>
        <p className="mt-2 text-ink-muted">"{room.prompt}"</p>
        <Link to="/instant/work" className="mt-6 inline-block text-primary hover:underline">← Back to Work</Link>
      </main>
    );
  }

  const creatorName = room.creator?.display_name || room.creator?.username || "Someone";
  const endsLabel = ends ? `ends in ${formatDistanceToNowStrict(ends)}` : "open-ended";

  const pinned = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {room.medium && (
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", categoryClass(room.medium as Category))}>
              {room.medium}
            </span>
          )}
          <span className="text-xs text-ink-muted inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {endsLabel}
          </span>
          <span className="text-xs text-ink-muted">· by {creatorName}</span>
        </div>
        <p className="mt-1.5 text-sm md:text-base text-ink font-medium leading-snug">{room.prompt}</p>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/instant/work" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Work
      </Link>
      <h1 className="mt-3 font-display text-2xl md:text-3xl text-ink flex items-center gap-2">
        <Hammer className="h-5 w-5" /> Work lobby
      </h1>

      <ChannelView key={room.id} roomId={room.id} title="this lobby" pinned={pinned} />
    </main>
  );
}

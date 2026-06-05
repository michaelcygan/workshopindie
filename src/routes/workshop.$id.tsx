import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Coffee } from "lucide-react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });
const FALLBACK_TITLE = "Workshop";

export const Route = createFileRoute("/workshop/$id")({
  component: LoungeRoomPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Workshop" },
      { name: "description", content: "A live Workshop. Drop in, talk shop, find your people." },
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

  const { data: room } = useQuery({
    queryKey: ["instant-room-title", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_rooms")
        .select("title")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const title = room?.title ?? FALLBACK_TITLE;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
            <span className="gradient-motion inline-flex h-10 w-10 items-center justify-center rounded-full text-primary-foreground"><Coffee className="h-5 w-5" /></span> {title}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Live Workshop · up to 5 artists.</p>
        </div>
      </div>

      <ChannelView key={id} roomId={id} title={title} initialMode={mode ?? "video"} />
    </main>
  );
}

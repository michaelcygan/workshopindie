import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Coffee } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { ChannelView } from "@/components/channel-view";

const searchSchema = z.object({ mode: z.enum(["voice", "video"]).optional() });
const TITLE = "Instant Workshop";

export const Route = createFileRoute("/instant/$id")({
  component: LoungeRoomPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Instant Workshop" },
      { name: "description", content: "A live Instant Workshop. Drop in, talk shop, find your people." },
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-ink flex items-center gap-2">
            <Coffee className="h-6 w-6 text-primary" /> {TITLE}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Live room · up to 5 artists.</p>
        </div>
      </div>

      <ChannelView key={id} roomId={id} title={TITLE} initialMode={mode ?? "voice"} />
    </main>
  );
}

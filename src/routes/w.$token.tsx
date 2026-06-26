import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users, Sparkles, DoorOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignupGateModal } from "@/components/signup-gate-modal";
import { peekLinkWorkshop, joinFromLink } from "@/lib/workshop-links.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$token")({
  component: LinkLanding,
  loader: ({ params }) => peekLinkWorkshop({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    const link = (loaderData as any)?.link;
    const title = link?.title ? `${link.title} — Workshop` : "Workshop";
    const desc = link?.prompt ?? "Drop into a live Lounge.";
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
    ];
    if (link?.cover_url) {
      meta.push({ property: "og:image", content: link.cover_url });
      meta.push({ property: "twitter:image", content: link.cover_url });
    }
    return { meta };
  },
});

function LinkLanding() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const join = useServerFn(joinFromLink);
  const peek = useServerFn(peekLinkWorkshop);

  const [gateOpen, setGateOpen] = useState(false);
  const [joining, setJoining] = useState(false);

  // Keep live count fresh
  const { data: fresh } = useQuery({
    queryKey: ["link-peek", token],
    queryFn: () => peek({ data: { token } }),
    initialData: initial,
    refetchInterval: 15_000,
  });

  const link = fresh?.link ?? initial?.link ?? null;
  const liveCount = fresh?.live_count ?? initial?.live_count ?? 0;

  const enterWorkshop = async () => {
    setJoining(true);
    try {
      const { roomId } = await join({ data: { token } });
      navigate({ to: "/lounge/$id", params: { id: roomId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join");
      setJoining(false);
    }
  };

  // When the user becomes signed-in (incl. after sign-up confirmation), auto-join.
  useEffect(() => {
    if (loading) return;
    if (user && !joining) {
      enterWorkshop();
    } else if (!user) {
      setGateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  if (!link) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl text-ink">This invite isn't active</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The link may have expired. Ask whoever shared it for a new one.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <a href="/">Back to Workshop</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Lounge shell — gated peek */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
        {link.cover_url ? (
          <div className="relative aspect-[16/9] w-full">
            <img
              src={link.cover_url}
              alt=""
              className={user ? "h-full w-full object-cover" : "h-full w-full object-cover blur-sm grayscale"}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-amber-200/40 via-rose-200/40 to-indigo-200/40" />
        )}

        <div className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            {link.category && <Badge variant="outline" className="uppercase text-[10px]">{link.category}</Badge>}
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20">
              <Users className="h-3 w-3" /> {liveCount} live now
            </Badge>
          </div>
          <h1 className="font-display text-3xl text-ink">{link.title}</h1>
          {link.prompt && <p className="text-ink-soft">{link.prompt}</p>}

          {/* Sealed peek: simulated participant tiles, content hidden */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {Array.from({ length: Math.min(4, Math.max(liveCount, 2)) }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted/70" />
            ))}
          </div>
          {!user && (
            <p className="text-center text-xs text-ink-muted">
              <Sparkles className="mr-1 inline h-3 w-3" />
              You'll see and hear others once you're inside.
            </p>
          )}

          <div className="flex justify-center pt-2">
            <Button
              size="lg"
              className="rounded-full gap-2"
              disabled={joining}
              onClick={() => (user ? enterWorkshop() : setGateOpen(true))}
            >
              <DoorOpen className="h-4 w-4" />
              {user ? (joining ? "Joining…" : "Join Lounge") : "Create free account & join"}
            </Button>
          </div>
        </div>
      </div>

      <SignupGateModal
        open={gateOpen && !user}
        onOpenChange={(open) => {
          // Allow closing, but the page stays gated; the Join button re-opens it.
          setGateOpen(open);
        }}
        title={`Join "${link.title}"`}
        subtitle="Create a free account to drop into the Lounge. It's quick."
        onAuthed={() => {
          setGateOpen(false);
          // useEffect will pick up the new user and auto-join, but kick it off now too.
          enterWorkshop();
        }}
      />
    </div>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { DoorOpen, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ensureWorkshopRoom } from "@/lib/workshop-room.functions";
import { toast } from "sonner";
import { WorkshopToolsPanel } from "@/components/workshop-tools-panel";
import type { Category } from "@/lib/categories";

export const Route = createFileRoute("/workshops/$slug/tools")({
  component: WorkshopToolsHub,
  head: ({ params }) => ({
    meta: [
      { title: "Studio Tools — Workshop" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://workshopindie.com/workshops/${params.slug}/tools`,
      },
    ],
  }),
});

type Workshop = {
  id: string;
  slug: string;
  title: string;
  host_user_id: string;
  archived_at: string | null;
  category: Category;
};

async function fetchWorkshop(slug: string): Promise<Workshop | null> {
  const { data } = await supabase
    .from("workshops")
    .select("id,slug,title,host_user_id,archived_at,category")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Workshop | null) ?? null;
}

function WorkshopToolsHub() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const ensureRoom = useServerFn(ensureWorkshopRoom);

  const { data: ws, isLoading } = useQuery({
    queryKey: ["workshop", slug],
    queryFn: () => fetchWorkshop(slug),
  });

  const { data: membership } = useQuery({
    queryKey: ["ws-membership", ws?.id, user?.id],
    enabled: !!ws && !!user,
    queryFn: async () => {
      if (ws!.host_user_id === user!.id) return { isMember: true };
      const { data } = await supabase
        .from("workshop_participants")
        .select("id,participant_status")
        .eq("workshop_id", ws!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      const ok =
        !!data && ["confirmed", "checked_in", "completed"].includes(data.participant_status);
      return { isMember: ok };
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-14">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
      </main>
    );
  }
  if (!ws) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Workshop not found</h1>
        <Link to="/workshops" className="mt-4 inline-block text-gradient-motion underline">
          Back to Workshops
        </Link>
      </main>
    );
  }

  if (ws.archived_at) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-muted" />
        <h1 className="mt-3 font-display text-3xl text-ink">This studio is closed</h1>
        <p className="mt-2 text-ink-soft">
          The Workshop was archived 30 days after its Work was published. Tools are no longer
          available.
        </p>
        <Link to="/workshops/$slug" params={{ slug }} className="mt-6 inline-block">
          <Button variant="outline" className="rounded-full">
            Back to Workshop
          </Button>
        </Link>
      </main>
    );
  }

  if (!user || !membership?.isMember) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-muted" />
        <h1 className="mt-3 font-display text-3xl text-ink">Members only</h1>
        <p className="mt-2 text-ink-soft">
          Studio tools are private to the Workshop's host and confirmed collaborators.
        </p>
        <Link to="/workshops/$slug" params={{ slug }} className="mt-6 inline-block">
          <Button variant="outline" className="rounded-full">
            Back to Workshop
          </Button>
        </Link>
      </main>
    );
  }

  async function openLive() {
    try {
      await ensureRoom({ data: { workshopId: ws!.id } });
      router.navigate({ to: "/workshops/$slug", params: { slug } });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open the live room");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              to="/workshops/$slug"
              params={{ slug }}
              className="text-xs uppercase tracking-wide text-ink-muted hover:text-ink"
            >
              ← {ws.title}
            </Link>
            <h1 className="mt-2 font-display text-4xl text-ink md:text-5xl">Studio Tools</h1>
            <p className="mt-2 max-w-xl text-ink-soft">
              The brushes stay in the studio. Same tools as the live room — pick one up anytime, with or without a session running.
            </p>
          </div>
          <Button onClick={openLive} className="rounded-full gap-2">
            <DoorOpen className="h-4 w-4" /> Enter live room
          </Button>
        </div>

        <div className="mt-8">
          <WorkshopToolsPanel
            scope={{
              kind: "persistent",
              workshopId: ws.id,
              hostUserId: ws.host_user_id,
              category: ws.category,
            }}
          />
        </div>
      </motion.div>
    </main>
  );
}

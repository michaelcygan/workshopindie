import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Mic,
  MonitorPlay,
  PenLine,
  FileText,
  FolderOpen,
  ListChecks,
  DoorOpen,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ensureWorkshopRoom } from "@/lib/workshop-room.functions";
import { toast } from "sonner";

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
};

async function fetchWorkshop(slug: string): Promise<Workshop | null> {
  const { data } = await supabase
    .from("workshops")
    .select("id,slug,title,host_user_id,archived_at")
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

  const tools: Array<{
    key: string;
    title: string;
    blurb: string;
    icon: React.ReactNode;
    action: () => void;
    soon?: boolean;
  }> = [
    {
      key: "recorder",
      title: "Recorder",
      blurb: "Capture takes from inside the live room.",
      icon: <Mic className="h-5 w-5" />,
      action: openLive,
    },
    {
      key: "screen",
      title: "Screen Share",
      blurb: "Share your screen with collaborators.",
      icon: <MonitorPlay className="h-5 w-5" />,
      action: openLive,
    },
    {
      key: "board",
      title: "Board",
      blurb: "Persistent moodboard — survives between sessions.",
      icon: <PenLine className="h-5 w-5" />,
      action: openLive,
      soon: true,
    },
    {
      key: "docs",
      title: "Docs",
      blurb: "Collaborative scripts, lyrics, treatments.",
      icon: <FileText className="h-5 w-5" />,
      action: () =>
        router.navigate({ to: "/workshops/$slug/tools/$tool", params: { slug, tool: "docs" } }),
    },
    {
      key: "drive",
      title: "Drive",
      blurb: "Pass files back and forth + paste cloud links.",
      icon: <FolderOpen className="h-5 w-5" />,
      action: () =>
        router.navigate({ to: "/workshops/$slug/tools/$tool", params: { slug, tool: "drive" } }),
    },
    {
      key: "tasks",
      title: "Tasks",
      blurb: "Lightweight checklist to actually ship.",
      icon: <ListChecks className="h-5 w-5" />,
      action: () =>
        router.navigate({ to: "/workshops/$slug/tools/$tool", params: { slug, tool: "tasks" } }),
    },
  ];

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
              The brushes stay in the studio. Nothing here is published with your Work.
            </p>
          </div>
          <Button onClick={openLive} className="rounded-full gap-2">
            <DoorOpen className="h-4 w-4" /> Enter live room
          </Button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <button
              key={t.key}
              onClick={t.action}
              className="group flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface p-5 text-left shadow-soft transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-ink">
                {t.icon}
              </div>
              <div className="flex w-full items-baseline justify-between gap-2">
                <h2 className="font-display text-xl text-ink">{t.title}</h2>
                {t.soon && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                    soon
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-soft">{t.blurb}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </main>
  );
}

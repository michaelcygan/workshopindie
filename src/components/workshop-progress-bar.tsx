import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Hammer, Users, Sparkles, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Workshop → Collab → Work → Gallery breadcrumb.
 * Lights up dots based on workshop row state. The "next" dot is the implicit CTA.
 */
export function WorkshopProgressBar({
  workshopId,
  workshopSlug,
  topicCollabPostId,
  publishedWorkId,
  isHost,
}: {
  workshopId: string;
  workshopSlug: string;
  topicCollabPostId: string | null;
  publishedWorkId: string | null;
  isHost: boolean;
}) {
  const { data: collab } = useQuery({
    queryKey: ["wpb-collab", topicCollabPostId],
    enabled: !!topicCollabPostId,
    queryFn: async () => {
      const { data } = await supabase
        .from("collab_posts")
        .select("slug, status, resulting_work_id")
        .eq("id", topicCollabPostId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: work } = useQuery({
    queryKey: ["wpb-work", publishedWorkId ?? collab?.resulting_work_id],
    enabled: !!(publishedWorkId ?? collab?.resulting_work_id),
    queryFn: async () => {
      const id = publishedWorkId ?? collab!.resulting_work_id!;
      const { data } = await supabase
        .from("works")
        .select("slug, status, published_at, visibility")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const hasCollab = !!topicCollabPostId;
  const hasWork = !!work;
  const isPublished = !!work?.published_at && work?.visibility === "public";

  const steps = [
    { key: "workshop", label: "Workshop", icon: Hammer, done: true, to: null as any },
    {
      key: "collab",
      label: "Collab",
      icon: Users,
      done: hasCollab,
      to: collab?.slug ? { to: "/collab/$slug", params: { slug: collab.slug } } : null,
    },
    {
      key: "work",
      label: "Work",
      icon: Sparkles,
      done: hasWork,
      to: work?.slug ? { to: "/works/$slug", params: { slug: work.slug } } : null,
    },
    {
      key: "gallery",
      label: "Gallery",
      icon: ImageIcon,
      done: isPublished,
      to: { to: "/gallery" } as any,
    },
  ];

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const content = (
            <div className={"flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition " +
              (s.done ? "bg-violet/10 text-violet" : "text-ink-muted hover:text-ink")}>
              <span className={"inline-flex h-5 w-5 items-center justify-center rounded-full " +
                (s.done ? "bg-violet text-white" : "border border-border bg-surface-2")}>
                {s.done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </span>
              <span className="font-medium">{s.label}</span>
            </div>
          );
          return (
            <div key={s.key} className="flex items-center gap-1">
              {s.to ? <Link {...s.to}>{content}</Link> : content}
              {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-ink-muted shrink-0" />}
            </div>
          );
        })}
      </div>
      {isHost && !hasCollab && (
        <p className="mt-2 text-[11px] text-ink-muted">
          When there's something worth shipping, turn this Workshop into a Collab from the live room.
        </p>
      )}
      {isHost && hasCollab && !hasWork && (
        <p className="mt-2 text-[11px] text-ink-muted">
          Ready to ship?{" "}
          <Link to="/works/new" className="underline hover:text-ink">Publish the Work</Link>{" "}
          and it'll show in the Gallery.
        </p>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DoorOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

type Props = {
  /** The Workshop the viewer might be able to enter. */
  workshopId: string;
  /** Optional pre-fetched slug to avoid a roundtrip. */
  slug?: string;
  /** Visual variant — `inline` is a small pill, `prominent` is a full button. */
  variant?: "inline" | "prominent";
};

/**
 * Renders nothing for non-members or for archived workshops.
 * Otherwise shows a link into the Workshop's studio.
 */
export function EnterWorkshopButton({ workshopId, slug, variant = "inline" }: Props) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["enter-workshop", workshopId, user?.id],
    enabled: !!user && !!workshopId,
    queryFn: async () => {
      const [{ data: ws }, { data: host }, { data: part }] = await Promise.all([
        supabase
          .from("workshops")
          .select("id,slug,host_user_id,archived_at,title")
          .eq("id", workshopId)
          .maybeSingle(),
        Promise.resolve({ data: null }),
        supabase
          .from("workshop_participants")
          .select("id,participant_status")
          .eq("workshop_id", workshopId)
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      if (!ws || ws.archived_at) return null;
      const isHost = ws.host_user_id === user!.id;
      const isParticipant =
        !!part && ["confirmed", "checked_in", "completed"].includes(part.participant_status);
      if (!isHost && !isParticipant) return null;
      return { slug: ws.slug as string };
    },
    staleTime: 30_000,
  });

  if (!user) return null;
  const targetSlug = slug ?? data?.slug;
  if (!targetSlug) return null;

  if (variant === "prominent") {
    return (
      <Button asChild className="rounded-full gap-2">
        <Link to="/workshops/$slug" params={{ slug: targetSlug }}>
          <DoorOpen className="h-4 w-4" /> Enter Workshop
        </Link>
      </Button>
    );
  }

  return (
    <Link
      to="/workshops/$slug"
      params={{ slug: targetSlug }}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft hover:text-ink hover:shadow-soft transition"
    >
      <DoorOpen className="h-3.5 w-3.5" /> Enter Workshop
    </Link>
  );
}

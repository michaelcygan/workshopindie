import { useEffect, useRef, useState } from "react";
import { Heart, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SignupGateModal } from "@/components/signup-gate-modal";
import { useWorkLike } from "@/hooks/use-work-like";

type Props = { workId: string; initialLikes: number; initialSaves: number };

export function WorkActions({ workId, initialLikes, initialSaves }: Props) {
  const { user } = useAuth();
  const like = useWorkLike(workId, initialLikes);
  const [saved, setSaved] = useState(false);
  const [saves, setSaves] = useState(initialSaves);
  const [savePending, setSavePending] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateKind, setGateKind] = useState<"like" | "save" | null>(null);
  const pendingSaveAfterAuthRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("work_reactions")
      .select("reaction")
      .eq("user_id", user.id)
      .eq("work_id", workId)
      .eq("reaction", "save")
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [user, workId]);

  useEffect(() => {
    if (!user || !pendingSaveAfterAuthRef.current) return;
    pendingSaveAfterAuthRef.current = false;
    void doToggleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function doToggleSave() {
    if (!user || savePending) return;
    setSavePending(true);
    const wasSaved = saved;
    setSaved((v) => !v);
    setSaves((n) => n + (wasSaved ? -1 : 1));
    const { data, error } = await supabase.rpc("toggle_work_reaction", {
      _work_id: workId,
      _reaction: "save",
    });
    setSavePending(false);
    if (error) {
      toast.error(error.message);
      setSaved(wasSaved);
      setSaves((n) => n + (wasSaved ? 1 : -1));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setSaves(row.save_count);
      setSaved(row.saved);
    }
  }

  function onLike() {
    if (!like.isAuthed) {
      like.queueForAfterAuth();
      setGateKind("like");
      setGateOpen(true);
      return;
    }
    void like.toggle();
  }

  function onSave() {
    if (!user) {
      pendingSaveAfterAuthRef.current = true;
      setGateKind("save");
      setGateOpen(true);
      return;
    }
    void doToggleSave();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={onLike}
          disabled={like.pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:shadow-soft",
            like.liked && "bg-primary/10 border-primary/30 text-primary",
          )}
        >
          <Heart className={cn("h-4 w-4", like.liked && "fill-current")} /> {like.likes}
        </button>
        <button
          onClick={onSave}
          disabled={savePending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:shadow-soft",
            saved && "bg-violet/10 border-violet/30 text-violet",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-current")} /> {saves}
        </button>
      </div>
      <SignupGateModal
        open={gateOpen}
        onOpenChange={(v) => {
          setGateOpen(v);
          if (!v) {
            like.clearQueued();
            pendingSaveAfterAuthRef.current = false;
          }
        }}
        title={gateKind === "save" ? "Save this piece" : "Favorite this piece"}
        subtitle={
          gateKind === "save"
            ? "Create your free account to save pieces to your portfolio."
            : "Create your free account to favorite pieces and follow the people who made them."
        }
      />
    </>
  );
}

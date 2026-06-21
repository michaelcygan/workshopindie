import { useEffect, useRef, useState } from "react";
import { Heart, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SignupGateModal } from "@/components/signup-gate-modal";

type Props = { workId: string; initialLikes: number; initialSaves: number };

export function WorkActions({ workId, initialLikes, initialSaves }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateKind, setGateKind] = useState<"like" | "save" | null>(null);
  const pendingAfterAuthRef = useRef<"like" | "save" | null>(null);
  const [likes, setLikes] = useState(initialLikes);
  const [saves, setSaves] = useState(initialSaves);
  const [pending, setPending] = useState<null | "like" | "save">(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("work_reactions")
      .select("reaction")
      .eq("user_id", user.id)
      .eq("work_id", workId)
      .then(({ data }) => {
        setLiked(!!data?.find((r) => r.reaction === "like"));
        setSaved(!!data?.find((r) => r.reaction === "save"));
      });
  }, [user, workId]);

  // Replay the pending like/save after the user authenticates via the gate.
  useEffect(() => {
    if (!user || !pendingAfterAuthRef.current) return;
    const kind = pendingAfterAuthRef.current;
    pendingAfterAuthRef.current = null;
    void doToggle(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function doToggle(kind: "like" | "save") {
    if (!user) return;
    if (pending) return;
    setPending(kind);
    // Optimistic
    if (kind === "like") {
      setLiked((v) => !v);
      setLikes((n) => n + (liked ? -1 : 1));
    } else {
      setSaved((v) => !v);
      setSaves((n) => n + (saved ? -1 : 1));
    }
    const { data, error } = await supabase.rpc("toggle_work_reaction", {
      _work_id: workId,
      _reaction: kind,
    });
    setPending(null);
    if (error) {
      toast.error(error.message);
      if (kind === "like") {
        setLiked((v) => !v);
        setLikes((n) => n + (liked ? 1 : -1));
      } else {
        setSaved((v) => !v);
        setSaves((n) => n + (saved ? 1 : -1));
      }
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setLikes(row.like_count);
      setSaves(row.save_count);
      setLiked(row.liked);
      setSaved(row.saved);
    }
  }

  function toggle(kind: "like" | "save") {
    if (!user) {
      pendingAfterAuthRef.current = kind;
      setGateKind(kind);
      setGateOpen(true);
      return;
    }
    void doToggle(kind);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggle("like")}
          disabled={pending === "like"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:shadow-soft",
            liked && "bg-primary/10 border-primary/30 text-primary",
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} /> {likes}
        </button>
        <button
          onClick={() => toggle("save")}
          disabled={pending === "save"}
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
          if (!v) pendingAfterAuthRef.current = null;
        }}
        title={gateKind === "save" ? "Save this work" : "Like this work"}
        subtitle={
          gateKind === "save"
            ? "Create your free account to save works to your portfolio."
            : "Create your free account to like work and follow the people who made it."
        }
      />
    </>
  );
}


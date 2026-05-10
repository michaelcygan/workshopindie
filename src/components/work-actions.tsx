import { useEffect, useState } from "react";
import { Heart, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Props = { workId: string; initialLikes: number; initialSaves: number };

export function WorkActions({ workId, initialLikes, initialSaves }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(initialLikes);
  const [saves, setSaves] = useState(initialSaves);

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

  async function toggle(kind: "like" | "save") {
    if (!user) return navigate({ to: "/login" });
    const isOn = kind === "like" ? liked : saved;
    if (isOn) {
      await supabase.from("work_reactions").delete().eq("user_id", user.id).eq("work_id", workId).eq("reaction", kind);
    } else {
      await supabase.from("work_reactions").insert({ user_id: user.id, work_id: workId, reaction: kind });
    }
    if (kind === "like") {
      setLiked(!isOn);
      setLikes((n) => n + (isOn ? -1 : 1));
    } else {
      setSaved(!isOn);
      setSaves((n) => n + (isOn ? -1 : 1));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => toggle("like")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:shadow-soft",
          liked && "bg-primary/10 border-primary/30 text-primary",
        )}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-current")} /> {likes}
      </button>
      <button
        onClick={() => toggle("save")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm transition hover:shadow-soft",
          saved && "bg-violet/10 border-violet/30 text-violet",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} /> {saves}
      </button>
    </div>
  );
}

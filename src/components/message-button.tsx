import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { checkCanDm, openOrCreateConversation } from "@/lib/dms.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function MessageButton({ otherUserId, variant = "outline", size = "sm", contextCollabPostId, contextWorkshopId }: {
  otherUserId: string;
  variant?: "outline" | "default";
  size?: "sm" | "default";
  contextCollabPostId?: string | null;
  contextWorkshopId?: string | null;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [canDm, setCanDm] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useServerFn(checkCanDm);
  const open = useServerFn(openOrCreateConversation);

  useEffect(() => {
    if (!user || user.id === otherUserId) return;
    let cancelled = false;
    check({ data: { otherUserId } }).then((r) => { if (!cancelled) setCanDm(r.canDm); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, otherUserId, check]);

  if (!user || user.id === otherUserId) return null;
  // Only show when the viewer is actually allowed to DM (mutual follow, open-DM opt-in, or allowed collab/workshop context).
  if (canDm !== true) return null;

  async function onClick() {
    setBusy(true);
    try {
      const r = await open({ data: { otherUserId, contextCollabPostId: contextCollabPostId ?? null, contextWorkshopId: contextWorkshopId ?? null } });
      navigate({ to: "/dms/$conversationId", params: { conversationId: r.conversationId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open conversation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={busy}
      variant={variant}
      size={size}
      className="rounded-full gap-1.5"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      Message
    </Button>
  );
}

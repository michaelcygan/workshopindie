import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BlockButton({ targetUserId }: { targetUserId: string }) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === targetUserId) return;
    supabase.from("user_blocks").select("blocked_user_id")
      .eq("blocker_user_id", user.id).eq("blocked_user_id", targetUserId).maybeSingle()
      .then(({ data }) => setBlocked(!!data));
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId || blocked === null) return null;

  async function toggle() {
    setBusy(true);
    if (blocked) {
      const { error } = await supabase.from("user_blocks").delete()
        .eq("blocker_user_id", user!.id).eq("blocked_user_id", targetUserId);
      if (error) { setBusy(false); return toast.error(error.message); }
      setBlocked(false);
      toast.success("Unblocked");
    } else {
      const { error } = await supabase.from("user_blocks")
        .insert({ blocker_user_id: user!.id, blocked_user_id: targetUserId });
      if (error) { setBusy(false); return toast.error(error.message); }
      setBlocked(true);
      toast.success("Blocked. You won't see their content.");
    }
    setBusy(false);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} disabled={busy}
      className="rounded-full gap-1.5 text-ink-muted hover:text-ink">
      <Ban className="h-3.5 w-3.5" /> {blocked ? "Unblock" : "Block"}
    </Button>
  );
}

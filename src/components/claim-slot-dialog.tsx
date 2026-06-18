import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { claimSlot, softHoldSlot } from "@/lib/lineup.functions";

export type LineupFieldsConfig = {
  act_type: boolean;
  link: boolean;
  notes: boolean;
};

export function ClaimSlotDialog({
  open,
  onOpenChange,
  slotId,
  position,
  fields,
  mode,
  onClaimed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slotId: string | null;
  position: number | null;
  fields: LineupFieldsConfig;
  mode: "open_claim" | "host_approval";
  onClaimed: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const claimFn = useServerFn(claimSlot);
  const holdFn = useServerFn(softHoldSlot);

  const [stageName, setStageName] = useState("");
  const [actType, setActType] = useState<"comedian" | "band" | "dj" | "other" | "">("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotId) return;
    const performer = {
      stage_name: stageName || null,
      act_type: actType || null,
      link_url: link || null,
      notes_to_host: notes || null,
    };
    setBusy(true);
    try {
      if (user) {
        const res = await claimFn({ data: { slot_id: slotId, performer } });
        toast.success(res.status === "requested" ? "Request sent — pending host approval." : "You're on the lineup!");
        onClaimed();
        onOpenChange(false);
      } else {
        if (!email) { toast.error("Email is required"); return; }
        const res = await holdFn({ data: { slot_id: slotId, email, performer } });
        if (typeof window !== "undefined") {
          window.localStorage.setItem("pendingLineupHold", JSON.stringify({ slot_id: slotId, email, at: Date.now() }));
        }
        toast.success(`Spot held for 5 minutes — finish signup to confirm. Expires ${new Date(res.expires_at).toLocaleTimeString()}.`);
        const next = encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/");
        navigate({ to: `/auth?next=${next}&email=${encodeURIComponent(email)}` as never });
      }
    } catch (ex) {
      toast.error((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Claim slot {position !== null ? `#${position}` : ""}
            {mode === "host_approval" && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">Host approval</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Stage / act name</Label>
            <Input value={stageName} onChange={(e) => setStageName(e.target.value)} maxLength={80} placeholder="Your name on the bill" />
          </div>
          {fields.act_type && (
            <div>
              <Label>Act type</Label>
              <Select value={actType} onValueChange={(v) => setActType(v as typeof actType)}>
                <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comedian">Comedian</SelectItem>
                  <SelectItem value="band">Band</SelectItem>
                  <SelectItem value="dj">DJ</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {fields.link && (
            <div>
              <Label>Link (Instagram, Spotify, set list)</Label>
              <Input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {fields.notes && (
            <div>
              <Label>Notes to host <span className="text-xs text-ink-muted">(private)</span></Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Tech needs, arrival time…" />
            </div>
          )}
          {!user && (
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <p className="mt-1 text-[11px] text-ink-muted">We'll hold the spot for 5 minutes while you finish signup.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{user ? "Claim spot" : "Hold spot & sign up"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

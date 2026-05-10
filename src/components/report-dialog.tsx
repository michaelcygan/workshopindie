import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RadioGroup, RadioGroupItem,
} from "@/components/ui/radio-group";

export type ReportEntityType = "work" | "profile" | "workshop" | "collab_post" | "comment";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "ip", label: "Intellectual property / impersonation" },
  { value: "off_topic", label: "Off-topic or low quality" },
  { value: "other", label: "Other" },
];

export function ReportDialog({
  entityType,
  entityId,
  trigger,
}: {
  entityType: ReportEntityType;
  entityId: string;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not file report", { description: error.message });
      return;
    }
    toast.success("Report submitted", { description: "Our team will review it shortly." });
    setOpen(false);
    setDescription("");
    setReason("spam");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-ink-muted hover:text-ink">
            <Flag className="h-4 w-4" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {entityType.replace("_", " ")}</DialogTitle>
          <DialogDescription>Tell us what's wrong. Reports are confidential.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">Reason</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="mt-2 space-y-2">
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="cursor-pointer text-sm font-normal">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="report-desc" className="text-sm">Details (optional)</Label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder="Add context that will help our review."
              className="mt-2"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit report"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

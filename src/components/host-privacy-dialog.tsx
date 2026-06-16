import { useEffect, useState } from "react";
import { Crown, Globe2, Users, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CATEGORIES, type Category } from "@/lib/categories";
import type { RoomVisibility } from "@/lib/instant.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultMedium: Category | null;
  defaultTitle?: string;
  busy?: boolean;
  onConfirm: (args: { title: string; visibility: RoomVisibility; medium: Category | null }) => void;
};

const OPTIONS: { id: RoomVisibility; label: string; blurb: string; Icon: typeof Globe2 }[] = [
  { id: "open",    label: "Open",         blurb: "Anyone can see it in Live now and drop into an open seat.",          Icon: Globe2 },
  { id: "mutuals", label: "Mutuals only", blurb: "Only people you mutually follow see it in Live now.",                  Icon: Users },
  { id: "invite",  label: "Invite link",  blurb: "Hidden from Live now. Share the link to fill seats yourself.",         Icon: Link2 },
];

export function HostPrivacyDialog({ open, onOpenChange, defaultMedium, defaultTitle, busy, onConfirm }: Props) {
  const [title, setTitle] = useState(defaultTitle ?? "");
  const [visibility, setVisibility] = useState<RoomVisibility>("open");
  const [medium, setMedium] = useState<Category | null>(defaultMedium);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle ?? "");
      setVisibility("open");
      setMedium(defaultMedium);
    }
  }, [open, defaultMedium, defaultTitle]);

  const mediumLabel = medium ? CATEGORIES.find((c) => c.id === medium)?.label ?? medium : "Open topic";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-violet" /> Open your Workshop
          </DialogTitle>
          <DialogDescription>
            Confirm who can find this room. You can change topic and title before it opens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-soft">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={`${mediumLabel} Workshop`}
              className="mt-1"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-ink-soft">Topic</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMedium(null)}
                className={"rounded-full px-3 py-1 text-xs transition " + (medium === null ? "bg-ink text-background" : "border border-border text-ink-soft hover:text-ink")}
              >
                Open topic
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setMedium(c.id)}
                  className={"rounded-full px-3 py-1 text-xs transition " + (medium === c.id ? "bg-ink text-background" : "border border-border text-ink-soft hover:text-ink")}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-ink-soft">Who can find this room?</div>
            <div className="mt-2 grid gap-2">
              {OPTIONS.map((o) => {
                const active = visibility === o.id;
                const Icon = o.Icon;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setVisibility(o.id)}
                    className={
                      "flex items-start gap-3 rounded-xl border p-3 text-left transition " +
                      (active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-ink/40")
                    }
                  >
                    <span className={"mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full " + (active ? "bg-primary text-primary-foreground" : "bg-muted text-ink-soft")}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink">{o.label}</span>
                      <span className="block text-xs text-ink-muted">{o.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {visibility !== "invite" && (
              <p className="mt-2 text-[11px] text-ink-muted">
                Your mutual follows will get a "drop in" notification when this opens.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm({ title: title.trim(), visibility, medium })}
            disabled={busy}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            {busy ? "Opening…" : "Open Workshop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

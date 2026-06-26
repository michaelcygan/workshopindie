import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { getMyCcConsent, setMyCcConsent } from "@/lib/cc-consent.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const LS_KEY = "wi.cc_ack.v1";

/**
 * Workshop Creative Commons consent dialog.
 *
 * Shown the first time a signed-in user lands on a Workshop, unless they've
 * already acknowledged via Settings → Privacy & Rights or dismissed it on
 * this device. Dismissing in any way (X, Esc, backdrop, "Got it") counts as
 * consent for this session; the checkbox ("Don't show this again") makes it
 * permanent across devices.
 */
export function CcConsentDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyCcConsent);
  const setFn = useServerFn(setMyCcConsent);

  const { data } = useQuery({
    queryKey: ["my-cc-consent"],
    queryFn: () => getFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [open, setOpen] = useState(false);
  const [persist, setPersist] = useState(true);

  useEffect(() => {
    if (!user || !data) return;
    if (data.ack) return; // perma-consent already given
    const local = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (local === "1") return; // dismissed on this device already
    setOpen(true);
  }, [user, data]);

  async function handleClose(next: boolean) {
    if (next) return; // opening — no-op
    setOpen(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_KEY, "1");
      }
      if (persist && user) {
        await setFn({ data: { ack: true } });
        qc.invalidateQueries({ queryKey: ["my-cc-consent"] });
      }
    } catch {
      // Silent: dismissal still works locally; user can manage in Settings.
    }
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="mb-1 inline-flex items-center gap-1.5 self-start rounded-full border border-border/70 bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            <Sparkles className="h-3 w-3" /> Lounge rights
          </div>
          <DialogTitle className="font-display text-2xl">
            Lounges are Creative Commons
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-ink-soft">
            Anything you share in a Lounge — chat, sketches, notes, links — is shared under{" "}
            <span className="font-medium text-ink">CC BY-SA 4.0</span> so collaborators can riff
            on it. Start a <span className="font-medium text-ink">Collab</span> to manage rights,
            find additional collaborators, and continue working on the project.
          </DialogDescription>
        </DialogHeader>

        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit text-xs font-medium text-primary hover:underline"
        >
          What CC BY-SA means →
        </a>

        <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5">
          <Checkbox
            id="cc-persist"
            checked={persist}
            onCheckedChange={(v) => setPersist(v === true)}
            className="mt-0.5"
          />
          <Label htmlFor="cc-persist" className="cursor-pointer text-xs leading-snug text-ink-soft">
            Don't show this again. You can turn the reminder back on anytime in{" "}
            <span className="text-ink">Settings → Privacy &amp; Rights</span>.
          </Label>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => handleClose(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

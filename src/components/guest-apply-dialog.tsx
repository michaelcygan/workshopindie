import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, ExternalLink, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { submitGuestApplication } from "@/lib/collab.functions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collabPostId: string;
  collabRoleId: string | null;
  postTitle: string;
  hostFirstName: string;
};

type Step = "form" | "success";

export function GuestApplyDialog(props: Props) {
  const navigate = useNavigate();
  const submit = useServerFn(submitGuestApplication);

  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    portfolioUrl: "",
    reelUrl: "",
    instagramHandle: "",
  });

  function update<K extends keyof typeof form>(key: K, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function reset() {
    setForm({ name: "", email: "", phone: "", message: "", portfolioUrl: "", reelUrl: "", instagramHandle: "" });
    setStep("form");
    setClaimToken(null);
    setCopied(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 1) return toast.error("Please add your name.");
    if (form.message.trim().length < 10) return toast.error("Tell the host a bit more (at least 10 characters).");
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          collabPostId: props.collabPostId,
          collabRoleId: props.collabRoleId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          portfolioUrl: form.portfolioUrl.trim(),
          reelUrl: form.reelUrl.trim(),
          instagramHandle: form.instagramHandle.trim(),
        },
      });
      if (res?.claimToken) setClaimToken(res.claimToken);
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const claimUrl =
    claimToken && typeof window !== "undefined" ? `${window.location.origin}/collab/claim/${claimToken}` : null;

  async function copyClaim() {
    if (!claimUrl) return;
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — long-press the link instead.");
    }
  }

  function goToSignup() {
    const [first, ...rest] = form.name.trim().split(/\s+/);
    const last = rest.join(" ");
    const params: Record<string, string> = {
      email: form.email,
      first: first ?? "",
      last: last ?? "",
      ig: form.instagramHandle.replace(/^@/, ""),
      from: "guest_apply",
    };
    if (claimToken) params.claim = claimToken;
    props.onOpenChange(false);
    navigate({ to: "/signup", search: params as never });
  }


  return (
    <Dialog
      open={props.open}
      onOpenChange={(v) => {
        props.onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-w-lg">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Apply to “{props.postTitle}”</DialogTitle>
              <DialogDescription>
                No account needed. {props.hostFirstName || "The host"} will see your message and contact details.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="mt-2 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="g-name">Your name</Label>
                  <Input id="g-name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-email">Email</Label>
                  <Input id="g-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="g-msg">Why you?</Label>
                <Textarea
                  id="g-msg"
                  required
                  rows={4}
                  maxLength={1000}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="A line on what you do, why this caught your eye, and what you'd bring."
                />
                <div className="text-right text-[11px] text-ink-muted">{form.message.length}/1000</div>
              </div>

              <details className="rounded-2xl border border-border bg-surface-2/40 px-4 py-3 [&[open]>summary]:mb-2">
                <summary className="cursor-pointer select-none text-sm text-ink-soft">
                  Add links + phone <span className="text-ink-muted">(optional, recommended)</span>
                </summary>
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="g-reel">Demo reel URL</Label>
                    <Input id="g-reel" placeholder="https://…" value={form.reelUrl} onChange={(e) => update("reelUrl", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="g-portfolio">Portfolio URL</Label>
                    <Input id="g-portfolio" placeholder="https://…" value={form.portfolioUrl} onChange={(e) => update("portfolioUrl", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="g-ig">Instagram</Label>
                      <Input id="g-ig" placeholder="@handle" value={form.instagramHandle} onChange={(e) => update("instagramHandle", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g-phone">Phone</Label>
                      <Input id="g-phone" placeholder="+1 555 …" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                    </div>
                  </div>
                </div>
              </details>

              <DialogFooter className="mt-3 gap-2">
                <Button type="button" variant="ghost" className="rounded-full" onClick={() => props.onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={submitting}>
                  {submitting ? "Sending…" : "Send application"}
                </Button>
              </DialogFooter>
              <p className="text-[11px] text-ink-muted">
                By sending you agree your contact info is shared with the post owner only.
              </p>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" /> Sent — they'll see it
              </DialogTitle>
              <DialogDescription>
                Your application is in {props.hostFirstName || "the host"}'s inbox.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 rounded-2xl border border-border bg-gradient-to-br from-surface-2 to-surface p-5">
              <h3 className="font-display text-xl text-ink">Want a real shot at it?</h3>
              <p className="mt-1.5 text-sm text-ink-muted">
                Posts on Workshop get reviewed faster when applicants have a profile — a face, a few past works,
                and one tap to reach back. Takes 30 seconds.
              </p>
              <Button onClick={goToSignup} className="mt-4 w-full rounded-full gap-2">
                <Sparkles className="h-4 w-4" /> Boost my application
              </Button>
              <button
                type="button"
                onClick={() => props.onOpenChange(false)}
                className="mt-2 block w-full text-center text-xs text-ink-muted hover:text-ink-soft"
              >
                Maybe later — close
              </button>
            </div>

            <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-ink-muted">
              <ExternalLink className="h-3 w-3" /> If you sign up with this email, we'll link your application to your profile automatically.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

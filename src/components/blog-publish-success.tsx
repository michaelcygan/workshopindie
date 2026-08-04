import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logShare } from "@/lib/share.functions";

export type PublishedPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
};

/**
 * The single confirmation of a publication. Uses the slug the server finalized,
 * never the draft slug held in editor state.
 */
export function BlogPublishSuccessDialog({
  post,
  open,
  onOpenChange,
  authorUserId,
}: {
  post: PublishedPostSummary | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  authorUserId?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const [refUsername, setRefUsername] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const log = useServerFn(logShare);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open || !authorUserId || refUsername !== null) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", authorUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setRefUsername(data?.username ?? "");
      });
    return () => {
      alive = false;
    };
  }, [open, authorUserId, refUsername]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!post) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = `${origin}/blog/${post.slug}`;
  const shareUrl = refUsername ? `${base}?ref=${refUsername}` : base;

  function track(channel: "copy" | "native") {
    if (!post) return;
    log({ data: { entityType: "blog_post", entityId: post.id, channel } }).catch(() => {});
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      track("copy");
    } catch {
      toast.error("Couldn't copy — try again");
    }
  }

  async function nativeShare() {
    if (!post) return;
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: post.title,
        text: post.excerpt ?? undefined,
        url: shareUrl,
      });
      track("native");
    } catch {
      // Cancelled — leave the dialog open and copy nothing.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-ink">Your post is live.</DialogTitle>
          <DialogDescription className="text-ink-soft">
            It has a public Workshop link. Share it while it's fresh.
          </DialogDescription>
        </DialogHeader>

        <p className="truncate rounded-2xl border border-border bg-surface px-4 py-2.5 text-[13px] text-ink-muted">
          {base.replace(/^https?:\/\//, "")}
        </p>

        <div className="mt-1 space-y-2">
          {canNativeShare && (
            <Button
              className="h-12 w-full justify-center gap-2 bg-primary text-primary-foreground"
              onClick={nativeShare}
            >
              <Share2 className="h-4 w-4" /> Share post
            </Button>
          )}
          <Button
            variant="outline"
            className="h-12 w-full justify-center gap-2 rounded-md"
            onClick={copyLink}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Link to="/blog/$slug" params={{ slug: post.slug }} className="block">
            <Button variant="outline" className="h-12 w-full justify-center gap-2 rounded-md">
              <ExternalLink className="h-4 w-4" /> View live
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-1 block h-11 w-full text-sm text-ink-muted hover:text-ink"
          >
            Back to editing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Share2, Copy, Check, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { logShare } from "@/lib/share.functions";
import { toast } from "sonner";

type Entity = {
  type: "work" | "workshop" | "profile" | "collab";
  id: string;
  url: string; // full URL without ref query
  title: string;
  subtitle?: string;
};

type Props = {
  entity: Entity;
  trigger?: React.ReactNode;
};

export function ShareSheet({ entity, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refUsername, setRefUsername] = useState<string | null>(null);
  const { user } = useAuth();
  const log = useServerFn(logShare);

  // Fetch viewer's username for ref attribution (lazy, only when sheet opens)
  async function ensureRef() {
    if (refUsername !== null || !user) return;
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    setRefUsername(data?.username ?? "");
  }

  const shareUrl = refUsername
    ? `${entity.url}${entity.url.includes("?") ? "&" : "?"}ref=${refUsername}`
    : entity.url;

  function track(channel: "copy" | "native" | "twitter" | "facebook" | "whatsapp" | "email") {
    log({ data: { entityType: entity.type, entityId: entity.id, channel } }).catch(() => {});
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
    if (typeof navigator === "undefined" || !navigator.share) return copyLink();
    try {
      await navigator.share({ title: entity.title, text: entity.subtitle, url: shareUrl });
      track("native");
      setOpen(false);
    } catch {
      /* cancelled */
    }
  }

  function openIntent(channel: "twitter" | "facebook" | "whatsapp" | "email") {
    const text = `${entity.title}${entity.subtitle ? ` — ${entity.subtitle}` : ""}`;
    const enc = encodeURIComponent;
    let href = "";
    switch (channel) {
      case "twitter":
        href = `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}`;
        break;
      case "facebook":
        href = `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`;
        break;
      case "whatsapp":
        href = `https://wa.me/?text=${enc(`${text} ${shareUrl}`)}`;
        break;
      case "email":
        href = `mailto:?subject=${enc(entity.title)}&body=${enc(`${text}\n\n${shareUrl}`)}`;
        break;
    }
    window.open(href, "_blank", "noopener,noreferrer");
    track(channel);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) ensureRef(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <Share2 className="h-4 w-4" /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription className="line-clamp-2">{entity.title}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button className="w-full justify-start gap-3 rounded-2xl" onClick={nativeShare}>
              <Share2 className="h-4 w-4" /> Share via…
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start gap-3 rounded-2xl" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy link"}
          </Button>
          <div className="grid grid-cols-4 gap-2 pt-1">
            <IntentButton label="X" onClick={() => openIntent("twitter")} />
            <IntentButton label="FB" onClick={() => openIntent("facebook")} />
            <IntentButton icon={<MessageCircle className="h-4 w-4" />} label="WA" onClick={() => openIntent("whatsapp")} />
            <IntentButton icon={<Mail className="h-4 w-4" />} label="Email" onClick={() => openIntent("email")} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntentButton({ icon, label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface px-2 py-3 text-xs text-ink-soft hover:bg-muted"
    >
      {icon ?? <span className="text-sm font-semibold text-ink">{label}</span>}
      {icon && <span>{label}</span>}
    </button>
  );
}

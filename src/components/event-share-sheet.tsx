import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Share2, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  shortCode: string | null;
  eventTitle: string;
  startsAt: string;
  /** Fallback canonical URL when no short_code exists yet. */
  canonicalUrl: string;
};

export function EventShareSheet({ shortCode, eventTitle, startsAt, canonicalUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://workshopindie.com";
  const printOrigin = origin.replace(/^https?:\/\//, "");
  const shortUrl = shortCode ? `${origin}/e/${shortCode}` : canonicalUrl;
  const printCaption = shortCode ? `${printOrigin}/e/${shortCode}` : printOrigin;

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(shortUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      color: { dark: "#0f0f10", light: "#ffffff" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [open, shortUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: eventTitle, url: shortUrl });
      } catch { /* user canceled */ }
    } else {
      copy();
    }
  }

  function downloadQr() {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${shortCode ?? "event"}-qr.png`;
    a.click();
  }

  const dateLabel = new Date(startsAt).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-full">
          <Share2 className="mr-1 h-4 w-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Get the link</DialogTitle>
          <DialogDescription className="text-xs">
            Short, print-friendly. Scan or share — anyone can view, attendees see more.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-2/50 p-5">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={`QR code for ${eventTitle}`} className="h-48 w-48 rounded-xl bg-white p-2 shadow-soft" />
          ) : (
            <div className="h-48 w-48 animate-pulse rounded-xl bg-ink/5" />
          )}
          <div className="text-center">
            <p className="font-display text-sm text-ink">{eventTitle}</p>
            <p className="text-[11px] text-ink-muted">{dateLabel}</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">{printCaption}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button onClick={copy} variant="outline" size="sm" className="rounded-full">
            {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onClick={downloadQr} variant="outline" size="sm" className="rounded-full" disabled={!qrUrl}>
            <Download className="mr-1 h-3.5 w-3.5" /> QR
          </Button>
          <Button onClick={nativeShare} size="sm" className="rounded-full">
            <Share2 className="mr-1 h-3.5 w-3.5" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

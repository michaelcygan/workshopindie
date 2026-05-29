import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Gift, Copy, Check, Sparkles, Share2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getMyReferralInfo } from "@/lib/referrals.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/refer")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: ReferPage,
  head: () => ({
    meta: [
      { title: "Refer & Earn — Free Plus | Workshop" },
      {
        name: "description",
        content:
          "Give a month, get a month. Earn free Plus for every friend who upgrades.",
      },
    ],
  }),
});

function ReferPage() {
  const fetchInfo = useServerFn(getMyReferralInfo);
  const { data, isLoading } = useQuery({
    queryKey: ["referral-info"],
    queryFn: () => fetchInfo({}),
  });

  const [copied, setCopied] = useState(false);

  const username = data?.username ?? "";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://workshopindie.com";
  const link = username ? `${origin}/?ref=${username}` : "";

  const shareText = `Join me on Workshop — the new way creatives work and network. Use my link to get started:`;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  }

  async function shareNative() {
    if (!link) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Workshop", text: shareText, url: link });
      } catch {
        // user cancelled — ignore
      }
    } else {
      await copyLink();
    }
  }

  async function shareInstagram() {
    if (!link) return;
    await copyLink();
    toast.success("Link copied — paste it into your Story", { duration: 4000 });
    window.open("https://instagram.com", "_blank", "noopener,noreferrer");
  }

  const s = data?.stats;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Gift className="h-6 w-6 icon-gradient-motion" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight text-ink">
          Give a month, get a month
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">
          Earn <span className="text-gradient-motion font-medium">1 free month of Plus</span> for
          every friend who upgrades. Stack as many as you can.
        </p>
      </div>

      {/* Link box */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-4 md:p-5">
        {isLoading ? (
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        ) : username ? (
          <>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 text-sm text-ink">
                {link}
              </div>
              <Button onClick={copyLink} size="sm" className="rounded-md gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={shareInstagram} variant="outline" size="sm" className="rounded-full gap-1.5">
                <Instagram className="h-4 w-4" /> Share to Instagram
              </Button>
              <Button onClick={shareNative} variant="outline" size="sm" className="rounded-full gap-1.5">
                <Share2 className="h-4 w-4" /> More
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Pick a username first to get your link.{" "}
            <Link to="/me/edit" className="underline">Edit profile</Link>
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Joined" value={s?.signedUp ?? 0} />
        <Stat label="Went Plus" value={s?.paid ?? 0} />
        <Stat label="Free months" value={s?.monthsEarned ?? 0} accent />
      </div>
      {!!s?.pendingMonths && s.pendingMonths > 0 && (
        <p className="mt-3 text-center text-xs text-ink-muted">
          {s.pendingMonths} month{s.pendingMonths === 1 ? "" : "s"} waiting — applied automatically
          when you go Plus.
        </p>
      )}

      {/* How it works */}
      <div className="mt-10">
        <h2 className="font-display text-lg text-ink">How it works</h2>
        <ol className="mt-3 space-y-3 text-sm text-ink-muted">
          <Step n={1} title="Share your link">
            Drop it in your Instagram story, DMs, or anywhere your people hang out.
          </Step>
          <Step n={2} title="They sign up and go Plus">
            When a friend upgrades through your link, you earn one free month.
          </Step>
          <Step n={3} title="We add it to your Plus automatically">
            Already on Plus? We extend your next bill. Not yet? We'll bank it for when you upgrade.
          </Step>
        </ol>
      </div>

      <div className="mt-10 flex justify-center">
        <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <Sparkles className="h-4 w-4 icon-gradient-motion" />
          Learn about Plus
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-4 text-center">
      <div className={accent ? "text-2xl font-display text-gradient-motion" : "text-2xl font-display text-ink"}>
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-ink">
        {n}
      </span>
      <div>
        <div className="text-ink font-medium">{title}</div>
        <div>{children}</div>
      </div>
    </li>
  );
}

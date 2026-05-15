import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Mic, Video, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { joinLounge } from "@/lib/instant.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/instant/")({
  component: InstantPreflight,
  head: () => ({
    meta: [
      { title: "Instant — Drop into the Artist's Lounge" },
      { name: "description", content: "Drop into a live Artist's Lounge. Voice or video, up to 5 per room." },
    ],
  }),
});

function InstantPreflight() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const drop = useServerFn(joinLounge);
  const [busy, setBusy] = useState<"voice" | "video" | null>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/login" });
  }, [user, loading, router]);

  async function handleDrop(mode: "voice" | "video") {
    if (busy) return;
    setBusy(mode);
    try {
      // Pre-grant media so the next page joins instantly without a permission prompt mid-flow.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });
        for (const t of stream.getTracks()) t.stop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Permission denied";
        toast.error(`Couldn't access ${mode === "video" ? "camera/mic" : "mic"}: ${msg}`);
        setBusy(null);
        return;
      }
      const { roomId } = await drop();
      router.navigate({ to: "/instant/$id", params: { id: roomId }, search: { mode } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't drop in");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6 md:py-20">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        <h1 className="font-display text-4xl text-ink md:text-6xl flex items-center gap-3">
          Artist's Lounge
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Drop into a live room with up to 5 artists. We'll find you a seat — there's always one open.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <DropButton icon={Mic} label="Drop in with Voice" onClick={() => handleDrop("voice")} loading={busy === "voice"} disabled={!!busy} primary />
        <DropButton icon={Video} label="Drop in with Video" onClick={() => handleDrop("video")} loading={busy === "video"} disabled={!!busy} />
      </div>
      <p className="mt-3 text-center text-xs text-ink-muted">
        Mic or camera required. Rooms cap at 5 — when one fills, the next person opens a fresh one.
      </p>
    </main>
  );
}

function DropButton({
  icon: Icon, label, onClick, loading, disabled, primary,
}: { icon: typeof Mic; label: string; onClick: () => void; loading?: boolean; disabled?: boolean; primary?: boolean }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={primary ? "default" : "outline"}
      size="lg"
      className="rounded-2xl h-auto py-6 flex-col gap-2"
    >
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
      <span className="text-sm font-medium">{label}</span>
    </Button>
  );
}

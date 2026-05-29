import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: () => <RequireAuth><CheckoutReturn /></RequireAuth>,
  head: () => ({
    meta: [
      { title: "Checkout complete — Workshop" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  // Webhook may take a beat — re-fetch subscription a few times.
  useEffect(() => {
    if (!session_id) return;
    const i = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      setTick((t) => t + 1);
    }, 1500);
    const stop = setTimeout(() => clearInterval(i), 12_000);
    return () => { clearInterval(i); clearTimeout(stop); };
  }, [session_id, queryClient]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h1 className="mt-4 font-display text-3xl text-ink">You're Plus ✨</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {session_id
          ? "Thanks for supporting Workshop. Every city, the full Workshop, and your unlimited portfolio are unlocked."
          : "No checkout session found. If you just paid, give it a few seconds and refresh."}
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/me"><Button className="rounded-full">Go to your profile</Button></Link>
        <Link to="/instant"><Button variant="outline" className="rounded-full">Drop in</Button></Link>
      </div>
      {tick > 0 && <p className="mt-4 text-xs text-ink-muted">Activating subscription…</p>}
    </main>
  );
}

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { redeemCompMembership } from "@/lib/comp.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/redeem/$code")({
  component: RedeemPage,
  head: () => ({ meta: [{ title: "Redeem invite — Workshop" }] }),
});

function RedeemPage() {
  const { user, loading } = useAuth();
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemCompMembership);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      throw redirect({ to: "/signup", search: { redirect: `/redeem/${code}` } as any });
    }
  }, [user, loading, code]);

  async function onRedeem() {
    setBusy(true);
    try {
      const res = await redeem({ data: { code } });
      setDone(res.expiresAt);
      toast.success("Plus unlocked ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't redeem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-soft">
        <Sparkles className="mx-auto h-8 w-8 text-gradient-motion" />
        <h1 className="mt-3 font-display text-2xl text-ink">You have an invite</h1>
        <p className="mt-1 text-sm text-ink-muted">Redeem this code for a complimentary Workshop Plus membership.</p>
        <p className="mt-4 inline-block rounded-full bg-muted px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink">{code}</p>

        {done ? (
          <div className="mt-6">
            <p className="text-sm text-ink">You're Plus until <span className="font-medium">{new Date(done).toLocaleDateString()}</span>.</p>
            <Link to="/me" className="mt-4 inline-block">
              <Button className="gradient-motion rounded-full text-primary-foreground">Go to my dashboard</Button>
            </Link>
          </div>
        ) : (
          <Button onClick={onRedeem} disabled={busy} className="gradient-motion mt-6 w-full rounded-full text-primary-foreground">
            {busy ? "Redeeming…" : "Redeem Plus"}
          </Button>
        )}
      </div>
    </main>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { claimPlusOfferByToken } from "@/lib/plus-offers.functions";

export const Route = createFileRoute("/claim/$token")({
  component: ClaimPage,
  head: () => ({
    meta: [
      { title: "Claim Workshop Plus" },
      { name: "description", content: "Redeem your Workshop Plus offer." },
    ],
  }),
});

function ClaimPage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claim = useServerFn(claimPlusOfferByToken);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { grantId: string; benefitType: "months" | "lifetime"; accessEndsAt: string | null }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // If signed out, bounce through login preserving destination.
  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(`/claim/${token}`);
      navigate({ to: `/login?redirect=${redirect}` as any });
    }
  }, [user, loading, token, navigate]);

  async function onClaim() {
    setBusy(true);
    setError(null);
    try {
      const res: any = await claim({ data: { token } });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setResult(res);
        toast.success("Workshop Plus unlocked ✨");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't claim";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-ink-muted">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-soft">
        <Sparkles className="mx-auto h-8 w-8 text-gradient-motion" />
        <h1 className="mt-3 font-display text-2xl text-ink">Claim Workshop Plus</h1>
        <p className="mt-1 text-sm text-ink-muted">
          You have a complimentary Workshop Plus offer waiting.
        </p>

        {result ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-ink">
              {result.benefitType === "lifetime"
                ? "Workshop Plus is yours — for life."
                : `You're Plus until ${result.accessEndsAt ? new Date(result.accessEndsAt).toLocaleDateString() : "—"}.`}
            </p>
            <Link to="/me" className="inline-block">
              <Button className="gradient-motion rounded-full text-primary-foreground">Go to my dashboard</Button>
            </Link>
          </div>
        ) : (
          <>
            <Button
              onClick={onClaim}
              disabled={busy}
              className="gradient-motion mt-6 w-full rounded-full text-primary-foreground"
            >
              {busy ? "Claiming…" : "Claim Workshop Plus"}
            </Button>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}

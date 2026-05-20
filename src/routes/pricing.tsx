import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePlus } from "@/hooks/use-plus";
import { Button } from "@/components/ui/button";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Pricing — Workshop" },
      { name: "description", content: "Free for portfolios, Collabs, and your home city. Plus is $4.99/mo for unlimited lounge time, all cities, and more." },
      { property: "og:title", content: "Pricing — Workshop" },
      { property: "og:description", content: "Free for portfolios, Collabs, and your home city. Plus is $4.99/mo for unlimited lounge time, all cities, and more." },
    ],
  }),
});

function PricingPage() {
  const { user } = useAuth();
  const { isPlus } = usePlus();
  const navigate = useNavigate();
  const [showCheckout, setShowCheckout] = useState(false);

  function handleGoPlus() {
    if (!user) return navigate({ to: "/signup" });
    setShowCheckout(true);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-20">
      <div className="text-center">
        <h1 className="font-display text-4xl text-ink md:text-6xl">Pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          Free is generous and built for real artists. Plus unlocks every city, unlimited lounge time, and your full portfolio.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <PlanCard
          name="Free"
          price="$0"
          tagline="The real artist starter."
          cta={user ? <Button variant="outline" className="w-full rounded-full" disabled>You're on Free</Button> : <Link to="/signup" className="block"><Button variant="outline" className="w-full rounded-full">Start free</Button></Link>}
          features={[
            "10 published works on your portfolio",
            "2 active open Collabs at a time",
            "Apply to unlimited Collabs",
            "Your home city — join, post, browse",
            "60 minutes / day in the Instant Lounge",
            "DMs, comments, credits — never gated",
          ]}
        />
        <PlanCard
          highlight
          name="Plus"
          price="$4.99"
          per="/ month"
          tagline="For artists actually using it."
          cta={
            isPlus ? (
              <Button variant="outline" className="w-full rounded-full" disabled>You're Plus ✨</Button>
            ) : (
              <Button onClick={handleGoPlus} className="w-full rounded-full gap-2">
                <Sparkles className="h-4 w-4" /> Go Plus
              </Button>
            )
          }
          features={[
            "Unlimited published works",
            "Unlimited active open Collabs + boosted placement",
            "All cities — join, post, filter gallery",
            "Unlimited Instant Lounge time + priority seat",
            "Plus badge on your profile + Credits strip",
            "Work analytics (views, saves, origin cities)",
            "Early access to new features as they ship",
          ]}
        />
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-ink-muted">
        Cancel anytime. Taxes calculated at checkout. Plus auto-renews monthly until canceled.
      </p>

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center">
          <div className="relative w-full max-w-md rounded-2xl bg-background p-4 shadow-xl">
            <button onClick={() => setShowCheckout(false)} className="absolute right-3 top-3 rounded-full p-1 text-ink-muted hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-display text-xl text-ink">Workshop Plus</h2>
            <p className="text-xs text-ink-muted">$4.99/mo · cancel anytime</p>
            <div className="mt-4">
              <StripeEmbeddedCheckout priceId="plus_monthly" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PlanCard({
  name, price, per, tagline, features, cta, highlight,
}: {
  name: string;
  price: string;
  per?: string;
  tagline: string;
  features: string[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-3xl border bg-surface p-6 md:p-8 ${highlight ? "border-primary shadow-lift" : "border-border"}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-ink">{name}</h2>
        {highlight && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" /> Recommended
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">{tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-5xl text-ink">{price}</span>
        {per && <span className="text-sm text-ink-muted">{per}</span>}
      </div>
      <ul className="mt-6 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  );
}

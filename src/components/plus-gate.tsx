import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export function PlusGate({ open, onOpenChange, title, description }: Props) {
  const [checkout, setCheckout] = useState(false);

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCheckout(false); }}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        {!checkout ? (
          <>
            <SheetHeader className="text-left">
              <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <SheetTitle className="text-center font-display text-2xl">{title}</SheetTitle>
              <SheetDescription className="text-center text-sm text-ink-muted">
                {description}
              </SheetDescription>
            </SheetHeader>

            <div className="mx-auto mt-6 max-w-sm space-y-3">
              <PlusBullet>All cities — join, post & filter the gallery beyond your home city</PlusBullet>
              <PlusBullet>Unlimited Workshop lounge time (Free is 60 min/day)</PlusBullet>
              <PlusBullet>Unlimited published works on your portfolio</PlusBullet>
              <PlusBullet>Unlimited active open Collabs + boosted placement</PlusBullet>
              <PlusBullet>Early access to new features as they ship</PlusBullet>
            </div>

            <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2 pb-6">
              <Button size="lg" className="rounded-full gap-2" onClick={() => setCheckout(true)}>
                <Sparkles className="h-4 w-4" /> Go Plus — $4.99/mo
              </Button>
              <button
                onClick={() => onOpenChange(false)}
                className="text-xs text-ink-muted hover:text-ink"
              >
                Maybe later
              </button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-xl">Go Plus</SheetTitle>
              <SheetDescription className="text-xs text-ink-muted">
                $4.99/mo · cancel anytime
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 pb-6">
              <StripeEmbeddedCheckout priceId="plus_monthly" />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlusBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-ink">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </div>
  );
}

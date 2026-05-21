import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type Stripe from "stripe";

function priceLookupKey(item: Stripe.SubscriptionItem | undefined): string | null {
  if (!item) return null;
  const price = item.price as (Stripe.Price & { lookup_key?: string | null }) | undefined;
  return (
    price?.lookup_key ||
    (price?.metadata as Record<string, string> | undefined)?.lovable_external_id ||
    price?.id ||
    null
  );
}

function tierFromPrice(priceId: string | null): "plus" | "free" {
  return priceId === "plus_monthly" ? "plus" : "free";
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription, env: StripeEnv) {
  const userId = (subscription.metadata as Record<string, string> | null)?.userId;
  if (!userId) {
    console.error("subscription event missing metadata.userId", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = priceLookupKey(item);
  const itemAny = item as (Stripe.SubscriptionItem & { current_period_end?: number; current_period_start?: number }) | undefined;
  const subAny = subscription as Stripe.Subscription & { current_period_end?: number; current_period_start?: number };
  const periodEnd = itemAny?.current_period_end ?? subAny.current_period_end;
  const periodStart = itemAny?.current_period_start ?? subAny.current_period_start;

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_price_id: priceId,
      tier: tierFromPrice(priceId),
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, env: StripeEnv) {
  await supabaseAdmin.from("subscriptions")
    .update({
      status: "canceled",
      tier: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const eventId = event.id;

  // Idempotency: skip if already processed
  if (eventId) {
    const { error: insErr } = await supabaseAdmin.from("processed_stripe_events").insert({
      event_id: eventId,
    });
    if (insErr && insErr.code === "23505") {
      console.log("Duplicate webhook event, skipping:", eventId);
      return;
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, env);
      break;
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice & {
        subscription_details?: { metadata?: Record<string, string> } | null;
        hosted_invoice_url?: string | null;
      };
      const userId = inv.subscription_details?.metadata?.userId
        || (inv.metadata as Record<string, string> | null)?.userId;
      if (userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          kind: "payment_failed",
          entity_type: "invoice",
          payload: { hosted_invoice_url: inv.hosted_invoice_url ?? null },
        });
      }
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

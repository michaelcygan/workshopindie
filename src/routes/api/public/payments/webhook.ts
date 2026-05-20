import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function priceLookupKey(item: any): string | null {
  return (
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id ||
    null
  );
}

function tierFromPrice(priceId: string | null): "plus" | "free" {
  return priceId === "plus_monthly" ? "plus" : "free";
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("subscription event missing metadata.userId", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = priceLookupKey(item);
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;

  await (getSupabase().from("subscriptions") as any).upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
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

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await (getSupabase().from("subscriptions") as any)
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
  const eventId = (event as any).id as string | undefined;

  // Idempotency: skip if already processed
  if (eventId) {
    const { error: insErr } = await (getSupabase().from("processed_stripe_events") as any).insert({
      event_id: eventId,
    });
    if (insErr && (insErr as any).code === "23505") {
      console.log("Duplicate webhook event, skipping:", eventId);
      return;
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpsert(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.payment_failed": {
      const inv: any = event.data.object;
      const userId = inv?.subscription_details?.metadata?.userId || inv?.metadata?.userId;
      if (userId) {
        await (getSupabase().from("notifications") as any).insert({
          user_id: userId,
          kind: "payment_failed",
          entity_type: "invoice",
          payload: { hosted_invoice_url: inv?.hosted_invoice_url ?? null },
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

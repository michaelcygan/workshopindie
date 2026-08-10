// Server-only newsletter primitives. Shared by the footer signup form and any
// other Workshop surface that collects an email with consent.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Idempotent subscribe. Re-subscribes a previously unsubscribed address and
 * never reveals whether the address already existed.
 */
export async function upsertNewsletterSubscriber(
  email: string,
  source: string,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("id,status")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "unsubscribed") {
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({
          status: "subscribed",
          unsubscribed_at: null,
          subscribed_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return;
  }

  await supabaseAdmin.from("newsletter_subscribers").insert({
    email,
    status: "subscribed",
    source,
  });
}

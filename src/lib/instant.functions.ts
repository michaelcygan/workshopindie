import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Matchmaker: drop the user into the fullest active Lounge that still has
 * room (cap 5), or spin up a brand-new Lounge if none has space. Guarantees
 * the user always gets a seat — there is no "Lounge is full" outcome.
 */
export const joinLounge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("join_lounge", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { roomId: data as string };
  });

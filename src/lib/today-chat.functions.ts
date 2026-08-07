import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BODY_MAX } from "./today-chat.server";

export const postTodayMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        groupId: z.string().uuid(),
        body: z.string().min(1).max(BODY_MAX),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Membership check, community standards, insert and @-mention delivery all
    // run inside the shared messaging pipeline. The database trigger that sets
    // expiry and blocks disallowed text stays in place behind it.
    const { sendTodayMessage } = await import("@/lib/messaging/pipeline.server");
    const { id } = await sendTodayMessage({ supabase, userId, subjectId: data.groupId }, data.body);
    return { ok: true, id };
  });

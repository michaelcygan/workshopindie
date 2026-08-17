import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HackathonMyTeam, HackathonPublicConfig } from "@/lib/events/hackathon";

const eventIdSchema = z.object({ event_id: z.string().uuid() });

/**
 * Public shape of a Hackathon: team names, sizes and the full-group time.
 * Room links are never part of it.
 */
export const getHackathonConfig = createServerFn({ method: "GET" })
  .inputValidator((i) => eventIdSchema.parse(i))
  .handler(async ({ data }): Promise<HackathonPublicConfig | null> => {
    const { loadPublicConfig } = await import("@/lib/events/hackathon.server");
    return loadPublicConfig(data.event_id);
  });

/** The signed-in participant's own team, including its private room link. */
export const getMyHackathonTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventIdSchema.parse(i))
  .handler(async ({ data, context }): Promise<HackathonMyTeam | null> => {
    const { loadMyTeam } = await import("@/lib/events/hackathon.server");
    return loadMyTeam(context.supabase, data.event_id, context.userId);
  });

export const saveHackathonSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        event_id: z.string().uuid(),
        full_group_meeting_at: z.string().min(1),
        teams: z
          .array(
            z.object({
              id: z.string().uuid().optional(),
              name: z.string().trim().min(1).max(80),
              meeting_url: z.string().trim().url().max(500),
            }),
          )
          .min(2)
          .max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { saveSetup } = await import("@/lib/events/hackathon.server");
    return saveSetup(context.supabase, context.userId, data);
  });

/** Organizer view: every team, its room link, and its full roster. */
export const getHackathonControlRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { loadControlRoom } = await import("@/lib/events/hackathon.server");
    return loadControlRoom(context.supabase, data.event_id, context.userId);
  });

/** Manual override. Automatic balancing is a default, never a cage. */
export const moveHackathonParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        event_id: z.string().uuid(),
        user_id: z.string().uuid(),
        team_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { moveParticipant } = await import("@/lib/events/hackathon.server");
    return moveParticipant(context.supabase, context.userId, data);
  });

/** Turn a configured Hackathon back into an ordinary Event. */
export const removeHackathonSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventIdSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { removeSetup } = await import("@/lib/events/hackathon.server");
    return removeSetup(context.supabase, data.event_id, context.userId);
  });
